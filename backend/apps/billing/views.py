from datetime import timedelta
from django.db.models import Q, Sum, Count, Prefetch, Exists, OuterRef, DateField, ExpressionWrapper
from django.db.models.functions import TruncMonth
from django.utils import timezone
from django.shortcuts import get_object_or_404
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from drf_spectacular.utils import extend_schema, inline_serializer, OpenApiParameter
from common.schema import object_schema
from common.permissions import (
    has_role,
    allowed,
    private_student_scope,
    OWNER,
    ADMIN,
    ACCOUNTANT,
    STUDENT,
    PARENT,
)
from apps.students.models import Student
from apps.education.models import Subject
from apps.education.models import Enrollment
from .models import Invoice, Payment, Adjustment, PaymentAllocation
from .serializers import InvoiceSerializer, PaymentSerializer, PersonalPaymentSummarySerializer
from .selectors import invoice_totals, personal_payment_summary
from .services import (
    generate_month,
    confirm_first,
    record_payment,
    void_payment,
    adjust_invoice,
    opening_balance,
    finance_permission,
)


def filter_invoices(qs, params):
    for param, field in [("student", "student_id"), ("subject", "subject_id")]:
        if value := params.get(param):
            qs = qs.filter(**{field: serializers.IntegerField(min_value=1).run_validation(value)})
    if month := params.get("month"):
        selected_month = serializers.DateField().run_validation(month)
        qs = qs.filter(**{"month__lt" if params.get("state") == "PREVIOUS" else "month": selected_month})
    if value := params.get("search"):
        qs = qs.filter(Q(student__full_name__icontains=value) | Q(student__phone__icontains=value))
    teaching_scope = {}
    for key in ["group", "teacher"]:
        if value := params.get(key):
            teaching_scope["group_id" if key == "group" else "group__teacher_id"] = serializers.IntegerField(
                min_value=1
            ).run_validation(value)
    if teaching_scope:
        memberships = Enrollment.objects.filter(
            **teaching_scope,
            student_id=OuterRef("student_id"),
            group__course__subject_id=OuterRef("subject_id"),
            start_date__lt=TruncMonth(
                ExpressionWrapper(OuterRef("month") + timedelta(days=32), output_field=DateField()),
                output_field=DateField(),
            ),
        ).filter(Q(end_date__isnull=True) | Q(end_date__gte=OuterRef("month")))
        qs = qs.filter(Exists(memberships))
    if student_state := params.get("student_state"):
        people = (
            qs.order_by()
            .values("student_id")
            .annotate(
                student_paid=Sum("paid_total"),
                student_balance=Sum("balance"),
                student_pending=Count("id", filter=Q(status="PENDING")),
            )
        )
        if student_state == "PAID":
            people = people.filter(student_pending=0, student_balance__lte=0)
        elif student_state == "PARTIAL":
            people = people.filter(student_paid__gt=0).filter(
                Q(student_balance__gt=0) | Q(student_pending__gt=0)
            )
        elif student_state == "UNPAID":
            people = people.filter(student_paid=0).exclude(student_pending=0, student_balance__lte=0)
        else:
            raise serializers.ValidationError("O‘quvchi to‘lov holati noto‘g‘ri.")
        qs = qs.filter(student_id__in=people.values("student_id"))
    today = timezone.localdate()
    state = params.get("state")
    states = {
        "OUTSTANDING": Q(status="CONFIRMED", balance__gt=0),
        "PENDING": Q(status="PENDING"),
        "PAID": Q(status="CONFIRMED", balance__lte=0),
        "PARTIAL": Q(status="CONFIRMED", paid_total__gt=0, balance__gt=0),
        "UNPAID": Q(status="CONFIRMED", paid_total=0, balance__gt=0),
        "WAITING": Q(status="CONFIRMED", balance__gt=0, due_date__gte=today),
        "OVERDUE": Q(status="CONFIRMED", balance__gt=0, due_date__lt=today),
        "PREVIOUS": Q(
            status="CONFIRMED",
            balance__gt=0,
            month__lt=serializers.DateField().run_validation(params.get("month"))
            if params.get("month")
            else today.replace(day=1),
        ),
    }
    if state:
        if state not in states:
            raise serializers.ValidationError("Hisob holati noto‘g‘ri.")
        qs = qs.filter(states[state])
    return qs


class InvoiceViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = InvoiceSerializer

    def check_permissions(self, request):
        super().check_permissions(request)
        if request.method in ["GET", "HEAD", "OPTIONS"] and not (
            has_role(request.user, OWNER, ADMIN, ACCOUNTANT, STUDENT, PARENT)
            or allowed(request.user, "billing.record_payment")
        ):
            raise PermissionDenied()

    def get_queryset(self):
        user = self.request.user
        qs = invoice_totals()
        if not has_role(user, OWNER, ADMIN, ACCOUNTANT):
            qs = qs.filter(student__in=private_student_scope(user))
        elif (
            has_role(user, ADMIN)
            and not has_role(user, OWNER, ACCOUNTANT)
            and self.action == "list"
            and not self.request.query_params.get("student")
        ):
            raise PermissionDenied("Administrator hisoblarni o‘quvchi bo‘yicha ko‘radi.")
        return filter_invoices(qs, self.request.query_params).order_by("-month", "student_id", "id")

    @extend_schema(
        request=inline_serializer("GenerateInvoicesRequest", fields={"month": serializers.DateField()}),
        responses={200: object_schema(created="integer")},
    )
    @action(detail=False, methods=["post"])
    def generate(self, request):
        finance_permission(request.user)
        month = serializers.DateField().run_validation(request.data.get("month"))
        if month > timezone.localdate().replace(day=1):
            raise serializers.ValidationError("Kelajak oyiga hisob chiqarilmaydi.")
        return Response({"created": generate_month(month, request.user)})

    @extend_schema(
        request=inline_serializer(
            "ConfirmFirstInvoiceRequest",
            fields={
                "amount": serializers.DecimalField(max_digits=14, decimal_places=2),
                "due_date": serializers.DateField(),
                "reason": serializers.CharField(),
            },
        ),
        responses=InvoiceSerializer,
    )
    @action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        obj = confirm_first(
            request.user,
            self.get_object(),
            request.data.get("amount"),
            serializers.DateField().run_validation(request.data.get("due_date")),
            request.data.get("reason", ""),
        )
        return Response(InvoiceSerializer(invoice_totals(Invoice.objects.filter(pk=obj.pk)).get()).data)

    @extend_schema(
        request=inline_serializer(
            "AdjustInvoiceRequest",
            fields={
                "amount": serializers.DecimalField(max_digits=14, decimal_places=2),
                "reason": serializers.CharField(),
            },
        ),
        responses={201: object_schema(id="integer", message="string")},
    )
    @action(detail=True, methods=["post"])
    def adjust(self, request, pk=None):
        obj = adjust_invoice(
            request.user, self.get_object(), request.data.get("amount"), request.data.get("reason", "")
        )
        return Response({"id": obj.pk, "message": "Tuzatish saqlandi."}, status=201)

    @extend_schema(
        request=inline_serializer(
            "OpeningBalanceRequest",
            fields={
                "student": serializers.IntegerField(),
                "subject": serializers.IntegerField(),
                "month": serializers.DateField(),
                "as_of": serializers.DateField(),
                "due_date": serializers.DateField(),
                "reason": serializers.CharField(),
                "amount": serializers.DecimalField(max_digits=14, decimal_places=2),
            },
        ),
        responses={201: object_schema(id="integer")},
    )
    @action(detail=False, methods=["post"], url_path="opening-balance")
    def opening(self, request):
        data = request.data
        finance_permission(request.user, "billing.correct_finance")
        obj = opening_balance(
            request.user,
            get_object_or_404(Student, pk=data.get("student")),
            get_object_or_404(Subject, pk=data.get("subject")),
            serializers.DateField().run_validation(data.get("month")),
            data.get("amount"),
            serializers.DateField().run_validation(data.get("due_date")),
            serializers.DateField().run_validation(data.get("as_of")),
            data.get("reason", ""),
        )
        return Response({"id": obj.pk}, status=201)


class PaymentViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = PaymentSerializer
    filterset_fields = ["student", "status", "paid_on"]
    search_fields = ["student__full_name", "student__phone"]
    ordering_fields = ["paid_on", "created_at", "id"]
    ordering = ["-paid_on", "-id"]

    def check_permissions(self, request):
        super().check_permissions(request)
        if request.method in ["GET", "HEAD", "OPTIONS"] and not (
            has_role(request.user, OWNER, ADMIN, ACCOUNTANT, STUDENT, PARENT)
            or allowed(request.user, "billing.record_payment")
        ):
            raise PermissionDenied()

    @extend_schema(
        parameters=[OpenApiParameter("student", int, OpenApiParameter.QUERY, required=True)],
        responses={200: object_schema(balance="string", invoice_count="integer", pending_count="integer")},
    )
    @action(detail=False, methods=["get"], url_path="options")
    def payment_options(self, request):
        finance_permission(request.user)
        student = get_object_or_404(
            Student,
            pk=serializers.IntegerField(min_value=1).run_validation(request.query_params.get("student")),
        )
        data = personal_payment_summary(Student.objects.filter(pk=student.pk))
        return Response(
            {
                key: str(data[key]) if key == "balance" else data[key]
                for key in ["balance", "invoice_count", "pending_count"]
            }
        )

    @extend_schema(
        parameters=[OpenApiParameter("subject", int, OpenApiParameter.QUERY)],
        responses=PersonalPaymentSummarySerializer,
    )
    @action(detail=False, methods=["get"])
    def summary(self, request):
        subject = request.query_params.get("subject")
        if subject:
            subject = serializers.IntegerField(min_value=1).run_validation(subject)
        data = personal_payment_summary(private_student_scope(request.user), subject or None)
        return Response(PersonalPaymentSummarySerializer(data).data)

    def get_queryset(self):
        qs = Payment.objects.select_related("student").prefetch_related(
            Prefetch("allocations", queryset=PaymentAllocation.objects.select_related("invoice__subject")),
            Prefetch("student__enrollments", queryset=Enrollment.objects.select_related("group__course")),
        )
        if subject := self.request.query_params.get("subject"):
            subject = serializers.IntegerField(min_value=1).run_validation(subject)
            qs = qs.filter(allocations__invoice__subject_id=subject).distinct()
        for param, field in [("from", "paid_on__gte"), ("to", "paid_on__lte")]:
            if value := self.request.query_params.get(param):
                qs = qs.filter(**{field: serializers.DateField().run_validation(value)})
        user = self.request.user
        if has_role(user, OWNER, ACCOUNTANT):
            return qs
        if has_role(user, ADMIN):
            if not self.request.query_params.get("student"):
                raise PermissionDenied()
            return qs
        return qs.filter(student__in=private_student_scope(user))

    @extend_schema(
        request=inline_serializer(
            "RecordPaymentRequest",
            fields={
                "student": serializers.IntegerField(),
                "amount": serializers.DecimalField(max_digits=14, decimal_places=2),
                "paid_on": serializers.DateField(),
                "note": serializers.CharField(required=False),
                "allocations": inline_serializer(
                    "PaymentAllocationRequest",
                    fields={
                        "invoice": serializers.IntegerField(),
                        "amount": serializers.DecimalField(max_digits=14, decimal_places=2),
                    },
                    many=True,
                    required=False,
                ),
            },
        ),
        parameters=[
            OpenApiParameter(
                "Idempotency-Key",
                str,
                OpenApiParameter.HEADER,
                required=True,
                description="Bir so‘rov uchun noyob UUID; takror yuborishda o‘sha qiymat.",
            )
        ],
        responses={200: PaymentSerializer, 201: PaymentSerializer},
    )
    def create(self, request):
        finance_permission(request.user)
        data = request.data
        student = get_object_or_404(
            Student, pk=serializers.IntegerField().run_validation(data.get("student"))
        )
        payment, created = record_payment(
            request.user,
            student,
            data.get("amount"),
            serializers.DateField().run_validation(data.get("paid_on")),
            data.get("allocations"),
            request.headers.get("Idempotency-Key", data.get("idempotency_key")),
            data.get("note", ""),
        )
        return Response(self.get_serializer(payment).data, status=201 if created else 200)

    @extend_schema(
        request=inline_serializer("VoidPaymentRequest", fields={"reason": serializers.CharField()}),
        responses=PaymentSerializer,
    )
    @action(detail=True, methods=["post"])
    def void(self, request, pk=None):
        return Response(
            self.get_serializer(
                void_payment(request.user, self.get_object(), request.data.get("reason", ""))
            ).data
        )


class AdjustmentViewSet(viewsets.ReadOnlyModelViewSet):
    from common.serializers import serializer_for

    serializer_class = serializer_for(Adjustment, ["invoice", "amount", "reason", "approved_by"])
    filterset_fields = ["invoice"]

    def check_permissions(self, request):
        super().check_permissions(request)
        if not has_role(request.user, OWNER, ACCOUNTANT, STUDENT, PARENT):
            raise PermissionDenied()

    def get_queryset(self):
        qs = Adjustment.objects.select_related("invoice")
        if has_role(self.request.user, OWNER, ACCOUNTANT):
            return qs
        return qs.filter(invoice__student__in=private_student_scope(self.request.user))
