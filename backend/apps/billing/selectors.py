from decimal import Decimal
from django.db.models import OuterRef, Subquery, Sum, DecimalField, Value, F, Q, Count
from django.db.models.functions import Coalesce
from .models import Invoice, Adjustment, PaymentAllocation

MONEY = DecimalField(max_digits=16, decimal_places=2)


def invoice_totals(queryset=None):
    queryset = Invoice.objects.all() if queryset is None else queryset
    adjustments = (
        Adjustment.objects.filter(invoice=OuterRef("pk"))
        .order_by()
        .values("invoice")
        .annotate(total=Sum("amount"))
        .values("total")
    )
    payments = (
        PaymentAllocation.objects.filter(invoice=OuterRef("pk"), payment__status="POSTED")
        .order_by()
        .values("invoice")
        .annotate(total=Sum("amount"))
        .values("total")
    )
    return (
        queryset.select_related("student", "subject")
        .annotate(
            adjustment_total=Coalesce(
                Subquery(adjustments, output_field=MONEY), Value(Decimal(0), output_field=MONEY)
            ),
            paid_total=Coalesce(
                Subquery(payments, output_field=MONEY), Value(Decimal(0), output_field=MONEY)
            ),
        )
        .annotate(total_amount=F("amount") + F("adjustment_total"))
        .annotate(balance=F("total_amount") - F("paid_total"))
    )


def personal_payment_summary(students, subject=None):
    from django.utils import timezone

    base = Invoice.objects.filter(student__in=students)
    subjects = [
        {"id": row["subject_id"], "name": row["subject__name"]}
        for row in base.order_by("subject__name", "subject_id")
        .values("subject_id", "subject__name")
        .distinct()
    ]
    if subject is not None:
        base = base.filter(subject_id=subject)
    confirmed = Q(status="CONFIRMED", balance__gt=0)
    today = timezone.localdate()
    data = invoice_totals(base).aggregate(
        invoice_count=Count("id"),
        pending_count=Count("id", filter=Q(status="PENDING")),
        balance_total=Sum("balance", filter=confirmed),
        overdue_balance=Sum("balance", filter=confirmed & Q(due_date__lt=today)),
        upcoming_balance=Sum("balance", filter=confirmed & Q(due_date__gte=today)),
    )
    data["balance"] = data.pop("balance_total")
    for key in ["balance", "overdue_balance", "upcoming_balance"]:
        data[key] = data[key] or Decimal(0)
    return {**data, "subjects": subjects}
