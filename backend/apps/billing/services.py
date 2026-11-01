import calendar
import hashlib
import json
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation
from uuid import UUID
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError
from common.permissions import allowed, ACCOUNTANT
from apps.audit.services import audit
from apps.students.models import Student
from apps.education.models import Enrollment, SubjectPrice
from apps.notifications.models import Notification
from apps.notifications.services import notify_student
from .models import Invoice, Payment, PaymentAllocation, Adjustment
from .selectors import invoice_totals


def money(value, positive=True):
    try:
        amount = Decimal(str(value))
        if (
            not amount.is_finite()
            or amount != amount.quantize(Decimal(".01"))
            or abs(amount) > Decimal("999999999999.99")
            or (positive and amount <= 0)
        ):
            raise ValueError
    except (InvalidOperation, ValueError, TypeError):
        raise ValidationError("Summa musbat, ikki kasrgacha bo‘lgan aniq son bo‘lsin.")
    return amount


def finance_permission(actor, permission="billing.record_payment"):
    if not allowed(actor, permission, ACCOUNTANT):
        raise PermissionDenied("Bu moliyaviy amal uchun vakolat yo‘q.")


@transaction.atomic
def generate_month(month, actor=None):
    if month.day != 1:
        raise ValidationError("Davr oyning birinchi sanasi bilan beriladi.")
    last = date(month.year, month.month, calendar.monthrange(month.year, month.month)[1])
    enrollments = (
        Enrollment.objects.filter(start_date__lte=last, student__status="ACTIVE")
        .filter(Q(end_date__isnull=True) | Q(end_date__gte=month))
        .exclude(group__status="ARCHIVED")
        .select_related("group__course__subject")
    )
    created = 0
    for enrollment in enrollments.order_by("student_id", "id"):
        Student.objects.select_for_update().get(pk=enrollment.student_id)
        subject = enrollment.group.course.subject
        first = (
            Enrollment.objects.filter(student_id=enrollment.student_id, group__course__subject=subject)
            .order_by("start_date")
            .values_list("start_date", flat=True)
            .first()
        )
        is_first = first.replace(day=1) == month
        if Invoice.objects.filter(student_id=enrollment.student_id, subject=subject, month=month).exists():
            continue
        defaults = {"is_first_month": is_first}
        if not is_first:
            price = (
                SubjectPrice.objects.filter(subject=subject, effective_from__lte=month)
                .order_by("-effective_from")
                .first()
            )
            if not price:
                raise ValidationError(f"{subject.name} uchun {month} sanasida narx belgilanmagan.")
            defaults.update(amount=price.amount, due_date=month.replace(day=10), status="CONFIRMED")
        invoice = Invoice.objects.create(
            student_id=enrollment.student_id, subject=subject, month=month, **defaults
        )
        audit(
            actor,
            "invoice.created",
            invoice,
            after={"month": str(month), "amount": str(invoice.amount), "status": invoice.status},
        )
        created += 1
    return created


@transaction.atomic
def confirm_first(actor, invoice, amount, due_date, reason):
    finance_permission(actor)
    invoice = Invoice.objects.select_for_update().get(pk=invoice.pk)
    if invoice.status != "PENDING" or not reason.strip():
        raise ValidationError("Faqat belgilanmagan hisob tasdiqlanadi. Sabab kerak.")
    if due_date < invoice.month:
        raise ValidationError("Muddat hisob oyidan oldin bo‘lmasin.")
    invoice.amount = money(amount)
    invoice.due_date = due_date
    invoice.status = "CONFIRMED"
    invoice.reason = reason
    invoice.save()
    audit(
        actor,
        "invoice.confirmed",
        invoice,
        after={"amount": str(invoice.amount), "due_date": str(due_date)},
        reason=reason,
    )
    return invoice


@transaction.atomic
def record_payment(actor, student, amount, paid_on, allocations, idempotency_key, note=""):
    finance_permission(actor)
    amount = money(amount)
    try:
        key = UUID(str(idempotency_key))
    except (ValueError, TypeError, AttributeError):
        raise ValidationError("To‘lov uchun UUID idempotency key kerak.")
    if paid_on > timezone.localdate():
        raise ValidationError("Kelajak sanasi bilan to‘lov kiritilmaydi.")
    if paid_on < timezone.localdate() and not allowed(actor, "billing.backdate_payment", ACCOUNTANT):
        raise PermissionDenied("Oldingi sanaga to‘lov kiritish vakolati kerak.")
    automatic = allocations is None
    if not automatic and (not isinstance(allocations, list) or not allocations):
        raise ValidationError("Hisoblarga taqsimot kerak.")
    try:
        normalized = (
            []
            if automatic
            else [{"invoice": int(a["invoice"]), "amount": str(money(a["amount"]))} for a in allocations]
        )
    except (KeyError, TypeError, ValueError):
        raise ValidationError("Taqsimot shakli noto‘g‘ri.")
    if not automatic and (
        len({x["invoice"] for x in normalized}) != len(normalized)
        or sum(Decimal(x["amount"]) for x in normalized) != amount
    ):
        raise ValidationError("Takroriy hisob bo‘lmasin. Taqsimotlar yig‘indisi to‘lovga teng bo‘lsin.")
    normalized.sort(key=lambda x: x["invoice"])
    fingerprint = hashlib.sha256(
        json.dumps(
            {
                "student": student.pk,
                "amount": str(amount),
                "paid_on": str(paid_on),
                "allocations": "AUTO" if automatic else normalized,
                "note": note,
            },
            sort_keys=True,
        ).encode()
    ).hexdigest()
    Student.objects.select_for_update().get(pk=student.pk)
    old = Payment.objects.filter(idempotency_key=key).first()
    if old:
        if old.request_fingerprint != fingerprint:
            raise ValidationError("Bu idempotency key boshqa so‘rovda ishlatilgan.")
        return old, False
    if automatic:
        # Serialize both payment modes for the same student before choosing invoices.
        locked_ids = list(
            Invoice.objects.select_for_update()
            .filter(student=student, status="CONFIRMED")
            .order_by("pk")
            .values_list("pk", flat=True)
        )
        outstanding = (
            invoice_totals(Invoice.objects.filter(pk__in=locked_ids))
            .filter(balance__gt=0)
            .order_by("due_date", "month", "pk")
        )
        remaining = amount
        for invoice in outstanding:
            portion = min(remaining, invoice.balance)
            normalized.append({"invoice": invoice.pk, "amount": str(portion)})
            remaining -= portion
            if not remaining:
                break
        if remaining:
            raise ValidationError(
                "Summa ochiq hisoblar qoldig‘idan katta. Avans yoki ortiqcha to‘lov qabul qilinmaydi."
            )
    ids = [x["invoice"] for x in normalized]
    locked = list(Invoice.objects.select_for_update().filter(pk__in=ids).order_by("pk"))
    if len(locked) != len(ids) or any(i.student_id != student.pk or i.status != "CONFIRMED" for i in locked):
        raise ValidationError("Hisoblar shu o‘quvchiga tegishli va tasdiqlangan bo‘lishi kerak.")
    balances = {i.pk: i.balance for i in invoice_totals(Invoice.objects.filter(pk__in=ids))}
    for allocation in normalized:
        if Decimal(allocation["amount"]) > balances[allocation["invoice"]]:
            raise ValidationError(
                "Hisob qoldig‘idan ortiq to‘lov qabul qilinmaydi. Avans siyosati hali belgilanmagan."
            )
    payment = Payment.objects.create(
        student=student,
        amount=amount,
        paid_on=paid_on,
        entered_by=actor,
        note=note,
        idempotency_key=key,
        request_fingerprint=fingerprint,
    )
    for allocation in normalized:
        PaymentAllocation.objects.create(
            payment=payment, invoice_id=allocation["invoice"], amount=allocation["amount"]
        )
    audit(
        actor,
        "payment.posted",
        payment,
        after={
            "student": student.pk,
            "amount": str(amount),
            "paid_on": str(paid_on),
            "allocations": normalized,
        },
    )
    refresh_reminders(ids)
    notify_student(
        student.pk,
        "PAYMENT",
        "To‘lov kiritildi",
        f"{amount:,.0f} so‘m to‘lov qabul qilindi. Sana: {paid_on}.",
        f"payment:{payment.pk}",
    )
    return payment, True


def refresh_reminders(invoice_ids):
    for invoice in invoice_totals(Invoice.objects.filter(pk__in=invoice_ids)):
        reminders = Notification.objects.filter(invoice=invoice, kind="REMINDER")
        if invoice.balance <= 0:
            reminders.update(resolved_at=timezone.now(), message="Ushbu hisob bo‘yicha qoldiq qolmadi.")
        else:
            reminders.update(
                resolved_at=None,
                message=f"{invoice.student.full_name}: {invoice.subject.name}, {invoice.month:%Y-%m} — qoldiq {invoice.balance:,.0f} so‘m. Muddat: {invoice.due_date}.",
            )


@transaction.atomic
def void_payment(actor, payment, reason):
    finance_permission(actor, "billing.correct_finance")
    if not reason.strip():
        raise ValidationError("Bekor qilish sababi majburiy.")
    Student.objects.select_for_update().get(pk=payment.student_id)
    payment = Payment.objects.select_for_update().get(pk=payment.pk)
    ids = list(payment.allocations.values_list("invoice_id", flat=True))
    list(Invoice.objects.select_for_update().filter(pk__in=ids).order_by("pk"))
    if payment.status == "VOID":
        raise ValidationError("To‘lov allaqachon bekor qilingan.")
    payment.status = "VOID"
    payment.void_reason = reason
    payment.voided_by = actor
    payment.voided_at = timezone.now()
    payment.save()
    audit(actor, "payment.voided", payment, reason=reason)
    refresh_reminders(ids)
    notify_student(
        payment.student_id,
        "PAYMENT_VOID",
        "To‘lov bekor qilindi",
        f"{payment.amount:,.0f} so‘m to‘lov bekor qilindi. Sabab: {reason}",
        f"payment-void:{payment.pk}",
    )
    return payment


@transaction.atomic
def adjust_invoice(actor, invoice, amount, reason):
    finance_permission(actor, "billing.correct_finance")
    invoice = Invoice.objects.select_for_update().get(pk=invoice.pk)
    delta = money(amount, positive=False)
    if not reason.strip() or delta == 0 or invoice.status != "CONFIRMED":
        raise ValidationError("Tasdiqlangan hisob, nol bo‘lmagan tuzatish va sabab kerak.")
    current = invoice_totals(Invoice.objects.filter(pk=invoice.pk)).get()
    if current.balance + delta < 0:
        raise ValidationError("Tuzatish hisobni to‘langan summadan pastga tushirmasligi kerak.")
    obj = Adjustment.objects.create(invoice=invoice, amount=delta, reason=reason, approved_by=actor)
    audit(actor, "invoice.adjusted", obj, after={"invoice": invoice.pk, "amount": str(delta)}, reason=reason)
    refresh_reminders([invoice.pk])
    return obj


@transaction.atomic
def opening_balance(actor, student, subject, month, amount, due_date, as_of, reason):
    finance_permission(actor, "billing.correct_finance")
    if not reason.strip() or month.day != 1 or as_of < month:
        raise ValidationError("Davr, qarz sanasi va asos kerak.")
    Student.objects.select_for_update().get(pk=student.pk)
    obj = Invoice.objects.create(
        student=student,
        subject=subject,
        month=month,
        amount=money(amount),
        due_date=due_date,
        status="CONFIRMED",
        is_opening_balance=True,
        opening_as_of=as_of,
        reason=reason,
    )
    audit(
        actor,
        "invoice.opening_balance",
        obj,
        after={"amount": str(obj.amount), "as_of": str(as_of)},
        reason=reason,
    )
    return obj


def send_reminders(today=None):
    today = today or timezone.localdate()
    count = 0
    invoices = invoice_totals(
        Invoice.objects.filter(status="CONFIRMED", month__lte=today.replace(day=1))
    ).filter(balance__gt=0)
    for invoice in invoices:
        reminder_date = (
            (invoice.due_date - timedelta(days=5)) if invoice.is_first_month else invoice.month.replace(day=5)
        )
        if today < reminder_date:
            continue
        notify_student(
            invoice.student_id,
            "REMINDER",
            "To‘lov eslatmasi",
            f"{invoice.subject.name}, {invoice.month:%Y-%m} — qoldiq {invoice.balance:,.0f} so‘m. Muddat: {invoice.due_date}.",
            f"reminder:{invoice.pk}",
            invoice=invoice,
        )
        count += 1
    return count
