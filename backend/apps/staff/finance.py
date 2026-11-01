from decimal import Decimal

from django.db.models import Count, OuterRef, Subquery, Sum, Q, Value, IntegerField
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import serializers, viewsets, filters
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.exceptions import PermissionDenied

from common.permissions import has_role, OWNER, ACCOUNTANT
from apps.billing.models import TeacherPayment
from apps.billing.selectors import MONEY
from apps.education.models import Enrollment, StudyGroup
from .models import TeacherProfile


class TeacherFinanceSerializer(serializers.ModelSerializer):
    student_count = serializers.IntegerField(read_only=True)
    group_count = serializers.IntegerField(read_only=True)
    paid_for_month = serializers.DecimalField(max_digits=16, decimal_places=2, read_only=True)
    total_paid = serializers.DecimalField(max_digits=16, decimal_places=2, read_only=True)
    phone = serializers.CharField(source="user.phone", read_only=True)
    account_active = serializers.BooleanField(source="user.is_active", read_only=True)
    subject_names = serializers.SerializerMethodField()

    def get_subject_names(self, obj) -> list[str]:
        return [subject.name for subject in obj.subjects.all()]

    class Meta:
        model = TeacherProfile
        fields = [
            "id",
            "full_name",
            "phone",
            "is_active",
            "account_active",
            "subject_names",
            "student_count",
            "group_count",
            "paid_for_month",
            "total_paid",
        ]


class TeacherSearchFilter(filters.SearchFilter):
    def get_search_fields(self, view, request):
        term = request.query_params.get("search", "")
        return (
            ["full_name"] if any(character.isalpha() for character in term) else ["full_name", "user__phone"]
        )


class TeacherFinanceViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = TeacherFinanceSerializer
    filter_backends = [DjangoFilterBackend, TeacherSearchFilter, filters.OrderingFilter]
    search_fields = ["full_name", "user__phone"]
    filterset_fields = ["is_active"]
    ordering = ["full_name", "id"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return TeacherProfile.objects.none()
        if not has_role(self.request.user, OWNER, ACCOUNTANT):
            raise PermissionDenied()
        today = timezone.localdate()
        month = (
            serializers.DateField()
            .run_validation(self.request.query_params.get("month") or today.replace(day=1).isoformat())
            .replace(day=1)
        )
        members = (
            Enrollment.objects.filter(
                group__teacher_id=OuterRef("pk"),
                group__status="ACTIVE",
                status="ACTIVE",
                student__status="ACTIVE",
                start_date__lte=today,
            )
            .filter(Q(end_date__isnull=True) | Q(end_date__gte=today))
            .order_by()
            .values("group__teacher")
            .annotate(total=Count("student", distinct=True))
            .values("total")
        )
        groups = (
            StudyGroup.objects.filter(teacher_id=OuterRef("pk"), status="ACTIVE")
            .order_by()
            .values("teacher")
            .annotate(total=Count("pk"))
            .values("total")
        )
        payments = TeacherPayment.objects.filter(teacher_id=OuterRef("pk"), status="POSTED").order_by()
        return (
            TeacherProfile.objects.select_related("user")
            .prefetch_related("subjects")
            .annotate(
                student_count=Coalesce(Subquery(members, output_field=IntegerField()), Value(0)),
                group_count=Coalesce(Subquery(groups, output_field=IntegerField()), Value(0)),
                paid_for_month=Coalesce(
                    Subquery(
                        payments.filter(month=month)
                        .values("teacher")
                        .annotate(total=Sum("amount"))
                        .values("total"),
                        output_field=MONEY,
                    ),
                    Value(Decimal(0), output_field=MONEY),
                ),
                total_paid=Coalesce(
                    Subquery(
                        payments.values("teacher").annotate(total=Sum("amount")).values("total"),
                        output_field=MONEY,
                    ),
                    Value(Decimal(0), output_field=MONEY),
                ),
            )
        )
