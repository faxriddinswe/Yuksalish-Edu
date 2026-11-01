from django.conf import settings
from django.db import models
from django.db.models import Q
from common.models import Timestamped


class Invoice(Timestamped):
    student = models.ForeignKey("students.Student", on_delete=models.PROTECT, related_name="invoices")
    subject = models.ForeignKey("education.Subject", on_delete=models.PROTECT)
    month = models.DateField(db_index=True)
    amount = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    due_date = models.DateField(null=True, blank=True, db_index=True)
    status = models.CharField(
        max_length=12,
        choices=[("PENDING", "Belgilanishi kerak"), ("CONFIRMED", "Tasdiqlangan")],
        default="PENDING",
    )
    is_first_month = models.BooleanField(default=False)
    is_opening_balance = models.BooleanField(default=False)
    opening_as_of = models.DateField(null=True, blank=True)
    reason = models.TextField(blank=True)

    class Meta:
        ordering = ["-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["student", "subject", "month"], name="invoice_student_subject_month"
            ),
            models.CheckConstraint(
                condition=Q(amount__isnull=True) | Q(amount__gte=0), name="invoice_nonnegative"
            ),
            models.CheckConstraint(
                condition=Q(status="PENDING", amount__isnull=True, due_date__isnull=True)
                | Q(status="CONFIRMED", amount__isnull=False, due_date__isnull=False),
                name="invoice_confirmation_consistency",
            ),
        ]
        permissions = [
            ("record_payment", "To‘lov kiritish"),
            ("backdate_payment", "To‘lovni oldingi sanaga kiritish"),
            ("correct_finance", "Moliyani tuzatish"),
        ]


class Adjustment(Timestamped):
    invoice = models.ForeignKey(Invoice, on_delete=models.PROTECT, related_name="adjustments")
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    reason = models.TextField()
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)

    class Meta:
        ordering = ["-id"]
        constraints = [models.CheckConstraint(condition=~Q(amount=0), name="nonzero_adjustment")]


class Payment(Timestamped):
    student = models.ForeignKey("students.Student", on_delete=models.PROTECT, related_name="payments")
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    paid_on = models.DateField(db_index=True)
    entered_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    note = models.CharField(max_length=500, blank=True)
    status = models.CharField(
        max_length=12, choices=[("POSTED", "Kiritilgan"), ("VOID", "Bekor qilingan")], default="POSTED"
    )
    idempotency_key = models.UUIDField(unique=True)
    request_fingerprint = models.CharField(max_length=64)
    void_reason = models.TextField(blank=True)
    voided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    voided_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-id"]
        constraints = [models.CheckConstraint(condition=Q(amount__gt=0), name="payment_positive")]


class PaymentAllocation(Timestamped):
    payment = models.ForeignKey(Payment, on_delete=models.PROTECT, related_name="allocations")
    invoice = models.ForeignKey(Invoice, on_delete=models.PROTECT, related_name="allocations")
    amount = models.DecimalField(max_digits=14, decimal_places=2)

    class Meta:
        ordering = ["-id"]
        constraints = [
            models.UniqueConstraint(fields=["payment", "invoice"], name="unique_payment_allocation"),
            models.CheckConstraint(condition=Q(amount__gt=0), name="allocation_positive"),
        ]


class TeacherPayment(Timestamped):
    teacher = models.ForeignKey("staff.TeacherProfile", on_delete=models.PROTECT, related_name="payouts")
    month = models.DateField(db_index=True)
    paid_on = models.DateField(db_index=True)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    note = models.CharField(max_length=500, blank=True)
    entered_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    status = models.CharField(
        max_length=12, choices=[("POSTED", "Kiritilgan"), ("VOID", "Bekor qilingan")], default="POSTED"
    )
    idempotency_key = models.UUIDField(unique=True)
    request_fingerprint = models.CharField(max_length=64)
    void_reason = models.TextField(blank=True)
    voided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    voided_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-paid_on", "-id"]
        constraints = [
            models.CheckConstraint(condition=Q(amount__gt=0), name="teacher_payment_positive"),
            models.CheckConstraint(condition=Q(month__day=1), name="teacher_payment_month_start"),
        ]
