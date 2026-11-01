import hashlib
from uuid import uuid4
from django.db import transaction
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import action
from drf_spectacular.utils import extend_schema
from common.schema import MESSAGE
from common.views import ManagedViewSet
from common.serializers import serializer_for
from apps.accounts.models import normalize_phone
from apps.accounts.services import rate_limit
from apps.students.models import Student
from apps.audit.services import audit
from .models import Lead

LeadSerializer = serializer_for(
    Lead,
    [
        "full_name",
        "phone",
        "course",
        "comment",
        "consent",
        "status",
        "assigned_to",
        "internal_notes",
        "converted_student",
    ],
    ["converted_student"],
)


class LeadViewSet(ManagedViewSet):
    queryset = Lead.objects.select_related("course", "assigned_to")
    serializer_class = LeadSerializer
    http_method_names = ["get", "patch", "put", "post", "delete", "head", "options"]
    filterset_fields = ["status", "course", "assigned_to"]
    search_fields = ["full_name", "phone"]

    def perform_create(self, serializer):
        serializer.validated_data["dedupe_key"] = uuid4().hex
        super().perform_create(serializer)

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def convert(self, request, pk=None):
        lead = Lead.objects.select_for_update().get(pk=self.get_object().pk)
        if lead.converted_student_id:
            return Response({"student_id": lead.converted_student_id})
        student = Student.objects.create(
            full_name=lead.full_name,
            phone=lead.phone,
            registered_on=timezone.localdate(),
            internal_notes=lead.comment,
        )
        lead.converted_student = student
        lead.status = "ENROLLED"
        lead.save()
        audit(request.user, "lead.converted", lead, after={"student": student.pk})
        audit(request.user, "student.created", student)
        return Response({"student_id": student.pk}, status=201)


class PublicLeadSerializer(serializers.Serializer):
    full_name = serializers.CharField(min_length=2, max_length=180)
    phone = serializers.CharField(max_length=30)
    course = serializers.IntegerField(required=False, allow_null=True)
    comment = serializers.CharField(required=False, allow_blank=True, max_length=1000)
    consent = serializers.BooleanField()
    website = serializers.CharField(required=False, allow_blank=True, max_length=300)

    def validate_phone(self, value):
        return normalize_phone(value)

    def validate_consent(self, value):
        if not value:
            raise serializers.ValidationError("Bog‘lanishga rozilik kerak.")
        return value


@method_decorator(csrf_protect, name="dispatch")
class PublicLeadView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(request=PublicLeadSerializer, responses={201: MESSAGE})
    def post(self, request):
        rate_limit("lead:" + request.META.get("REMOTE_ADDR", ""), 8, 600)
        serializer = PublicLeadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if data.pop("website", ""):
            return Response({"message": "Murojaatingiz qabul qilindi."}, status=201)
        course = data.pop("course", None)
        if course:
            from apps.education.models import Course

            if not Course.objects.filter(pk=course, publication_status="PUBLISHED", is_active=True).exists():
                raise serializers.ValidationError("Kurs topilmadi.")
        key = hashlib.sha256(f"{data['phone']}:{course}:{timezone.localdate()}".encode()).hexdigest()
        Lead.objects.get_or_create(dedupe_key=key, defaults={**data, "course_id": course})
        return Response(
            {"message": "Murojaatingiz qabul qilindi. Markaz xodimi siz bilan bog‘lanadi."}, status=201
        )
