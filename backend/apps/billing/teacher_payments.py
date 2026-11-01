import hashlib
import json
from uuid import UUID

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError, PermissionDenied
from common.permissions import allowed, ACCOUNTANT

from apps.audit.services import audit
from apps.staff.models import TeacherProfile
from .models import TeacherPayment
from .services import finance_permission, money


@transaction.atomic
def record_teacher_payment(actor, teacher, month, paid_on, amount, note, key):
    finance_permission(actor)
    amount = money(amount)
    if month.day != 1:
        raise ValidationError("Davr oyning birinchi sanasi bilan beriladi.")
    if paid_on > timezone.localdate():
        raise ValidationError("Kelajak sanasi bilan to‘lov kiritilmaydi.")
    if len(note) > 500:
        raise ValidationError("Izoh 500 belgidan oshmasin.")
    try:
        key = UUID(str(key))
    except (ValueError, TypeError, AttributeError):
        raise ValidationError("Noyob UUID idempotency key kerak.")
    fingerprint = hashlib.sha256(
        json.dumps(
            {
                "teacher": teacher.pk,
                "month": str(month),
                "paid_on": str(paid_on),
                "amount": str(amount),
                "note": note,
            },
            sort_keys=True,
        ).encode()
    ).hexdigest()
    teacher = TeacherProfile.objects.select_for_update().select_related("user").get(pk=teacher.pk)
    old = TeacherPayment.objects.filter(idempotency_key=key).first()
    if old:
        if old.request_fingerprint != fingerprint:
            raise ValidationError("Bu idempotency key boshqa to‘lovda ishlatilgan.")
        return old, False
    if not teacher.is_active or not teacher.user.is_active:
        raise ValidationError("Faqat faol ustozga yangi to‘lov kiritiladi.")
    payment = TeacherPayment.objects.create(
        teacher=teacher,
        month=month,
        paid_on=paid_on,
        amount=amount,
        note=note,
        entered_by=actor,
        idempotency_key=key,
        request_fingerprint=fingerprint,
    )
    audit(
        actor,
        "teacher_payment.posted",
        payment,
        after={
            "teacher": teacher.pk,
            "month": str(month),
            "paid_on": str(paid_on),
            "amount": str(amount),
            "note": note,
        },
    )
    return payment, True


@transaction.atomic
def void_teacher_payment(actor, payment, reason):
    if not allowed(actor, "billing.correct_finance", ACCOUNTANT):
        raise PermissionDenied("Moliyaviy tuzatish vakolati kerak.")
    if not reason.strip():
        raise ValidationError("Bekor qilish sababini kiriting.")
    payment = TeacherPayment.objects.select_for_update().get(pk=payment.pk)
    if payment.status == "VOID":
        return payment
    payment.status = "VOID"
    payment.void_reason = reason.strip()
    payment.voided_by = actor
    payment.voided_at = timezone.now()
    payment.save()
    audit(
        actor, "teacher_payment.voided", payment, after={"amount": str(payment.amount)}, reason=reason.strip()
    )
    return payment
