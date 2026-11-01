from rest_framework import serializers
from .models import Invoice, Payment, PaymentAllocation, TeacherPayment


class InvoiceSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.full_name")
    subject_name = serializers.CharField(source="subject.name")
    paid_total = serializers.DecimalField(max_digits=16, decimal_places=2, read_only=True)
    adjustment_total = serializers.DecimalField(max_digits=16, decimal_places=2, read_only=True)
    balance = serializers.DecimalField(max_digits=16, decimal_places=2, read_only=True, allow_null=True)
    total_amount = serializers.DecimalField(max_digits=16, decimal_places=2, read_only=True, allow_null=True)
    payment_state = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = [
            "id",
            "student",
            "student_name",
            "subject",
            "subject_name",
            "month",
            "amount",
            "due_date",
            "status",
            "is_first_month",
            "is_opening_balance",
            "opening_as_of",
            "reason",
            "paid_total",
            "adjustment_total",
            "balance",
            "total_amount",
            "payment_state",
            "created_at",
        ]

    def get_payment_state(self, obj) -> str:
        from django.utils import timezone

        if obj.status == "PENDING":
            return "PENDING"
        if obj.balance <= 0:
            return "PAID"
        if obj.due_date < timezone.localdate():
            return "OVERDUE"
        return "PARTIAL" if obj.paid_total > 0 else "UNPAID"


class PaymentAllocationSerializer(serializers.ModelSerializer):
    subject = serializers.IntegerField(source="invoice.subject_id", read_only=True)
    subject_name = serializers.CharField(source="invoice.subject.name", read_only=True)
    month = serializers.DateField(source="invoice.month", read_only=True)
    course_names = serializers.SerializerMethodField()

    class Meta:
        model = PaymentAllocation
        fields = ["invoice", "amount", "subject", "subject_name", "month", "course_names"]

    def get_course_names(self, obj) -> list[str]:
        from calendar import monthrange

        month = obj.invoice.month
        end = month.replace(day=monthrange(month.year, month.month)[1])
        return sorted(
            {
                enrollment.group.course.name
                for enrollment in obj.payment.student.enrollments.all()
                if enrollment.group.course.subject_id == obj.invoice.subject_id
                and enrollment.start_date <= end
                and (enrollment.end_date is None or enrollment.end_date >= month)
            }
        )


class PaymentSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.full_name", read_only=True)
    allocations = PaymentAllocationSerializer(many=True, read_only=True)

    def to_representation(self, instance):
        from common.permissions import has_role, OWNER, ADMIN, ACCOUNTANT

        data = super().to_representation(instance)
        request = self.context.get("request")
        if request and not has_role(request.user, OWNER, ADMIN, ACCOUNTANT):
            data.pop("entered_by", None)
        return data

    class Meta:
        model = Payment
        fields = [
            "id",
            "student",
            "student_name",
            "amount",
            "paid_on",
            "created_at",
            "entered_by",
            "status",
            "note",
            "allocations",
            "void_reason",
        ]


class PaymentSummarySubjectSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()


class PersonalPaymentSummarySerializer(serializers.Serializer):
    invoice_count = serializers.IntegerField()
    pending_count = serializers.IntegerField()
    balance = serializers.DecimalField(max_digits=16, decimal_places=2)
    overdue_balance = serializers.DecimalField(max_digits=16, decimal_places=2)
    upcoming_balance = serializers.DecimalField(max_digits=16, decimal_places=2)
    subjects = PaymentSummarySubjectSerializer(many=True)


class TeacherPaymentSerializer(serializers.ModelSerializer):
    teacher_name = serializers.CharField(source="teacher.full_name", read_only=True)
    entered_by_name = serializers.CharField(source="entered_by.full_name", read_only=True)

    class Meta:
        model = TeacherPayment
        fields = [
            "id",
            "teacher",
            "teacher_name",
            "month",
            "paid_on",
            "amount",
            "note",
            "status",
            "entered_by_name",
            "created_at",
            "void_reason",
        ]


class TeacherPaymentRequest(serializers.Serializer):
    teacher = serializers.IntegerField(min_value=1)
    month = serializers.DateField()
    paid_on = serializers.DateField()
    amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    note = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")
