from decimal import Decimal
from datetime import date
from django.db.models import Sum, Count, Q
from django.utils import timezone
from apps.students.models import Student
from apps.billing.models import PaymentAllocation, TeacherPayment
from apps.billing.selectors import invoice_totals
from apps.billing.views import filter_invoices


def report_scope(params):
    month = params.get("month") or timezone.localdate().replace(day=1).isoformat()
    from rest_framework import serializers

    start = serializers.DateField().run_validation(month)
    start = start.replace(day=1)
    end = date(start.year + 1, 1, 1) if start.month == 12 else date(start.year, start.month + 1, 1)
    scope = {k: v for k, v in params.items() if k not in ["state", "month", "student_state"] and v}
    all_invoices = filter_invoices(invoice_totals(), scope)
    selected_filters = {key: params[key] for key in ["state", "student_state"] if params.get(key)}
    if params.get("state") == "PREVIOUS":
        invoices = filter_invoices(all_invoices, {**selected_filters, "month": str(start)})
    else:
        invoices = filter_invoices(all_invoices.filter(month=start), selected_filters)
    cash = PaymentAllocation.objects.filter(
        payment__status="POSTED",
        payment__paid_on__gte=start,
        payment__paid_on__lt=end,
        invoice_id__in=all_invoices.values("pk"),
    )
    return start, invoices, all_invoices, cash


def financial_report(params):
    start, invoices, all_invoices, cash = report_scope(params)
    sums = invoices.aggregate(
        billed=Sum("total_amount"),
        paid=Sum("paid_total"),
        remaining=Sum("balance"),
        invoices=Count("id"),
        pending=Count("id", filter=Q(status="PENDING")),
    )
    people = list(
        invoices.order_by()
        .values("student_id")
        .annotate(
            total=Sum("total_amount"),
            paid=Sum("paid_total"),
            remaining=Sum("balance"),
            pending=Count("id", filter=Q(status="PENDING")),
        )
    )
    states = {"paid_students": 0, "partial_students": 0, "unpaid_students": 0}
    for person in people:
        if not person["pending"] and person["remaining"] is not None and person["remaining"] <= 0:
            states["paid_students"] += 1
        elif (person["paid"] or 0) > 0:
            states["partial_students"] += 1
        else:
            states["unpaid_students"] += 1
    previous = all_invoices.filter(status="CONFIRMED", month__lt=start, balance__gt=0).aggregate(
        total=Sum("balance")
    )["total"] or Decimal(0)
    today = timezone.localdate()
    overdue = invoices.filter(status="CONFIRMED", balance__gt=0, due_date__lt=today)
    waiting = invoices.filter(status="CONFIRMED", balance__gt=0, due_date__gte=today)
    payouts = teacher_payment_scope(params)
    end = date(start.year + 1, 1, 1) if start.month == 12 else date(start.year, start.month + 1, 1)
    return {
        "month": str(start),
        "total_students": Student.objects.count(),
        "active_students": Student.objects.filter(status="ACTIVE").count(),
        "billed": str(sums["billed"] or 0),
        "cash_received": str(cash.aggregate(total=Sum("amount"))["total"] or 0),
        "paid_for_month": str(sums["paid"] or 0),
        "remaining": str(sums["remaining"] or 0),
        "previous_debt": str(previous),
        "pending_first_invoices": sums["pending"],
        "invoice_count": sums["invoices"],
        "student_count": len(people),
        "overdue_students": overdue.values("student_id").distinct().count(),
        "waiting_students": waiting.values("student_id").distinct().count(),
        "overdue_amount": str(overdue.aggregate(total=Sum("balance"))["total"] or 0),
        "teacher_paid_for_month": str(
            payouts.filter(month=start).aggregate(total=Sum("amount"))["total"] or 0
        ),
        "teacher_cash_paid": str(
            payouts.filter(paid_on__gte=start, paid_on__lt=end).aggregate(total=Sum("amount"))["total"] or 0
        ),
        **states,
    }


def teacher_payment_scope(params):
    from rest_framework import serializers

    qs = TeacherPayment.objects.filter(status="POSTED")
    if teacher := params.get("teacher"):
        qs = qs.filter(teacher_id=serializers.IntegerField(min_value=1).run_validation(teacher))
    return qs
