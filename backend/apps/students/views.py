from django.db import transaction
from django.db.models import Exists, OuterRef, Prefetch
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from drf_spectacular.utils import extend_schema, OpenApiParameter
from apps.content.scopes import student_certificates
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from common.views import ManagedViewSet
from common.permissions import has_role, student_scope, OWNER, ADMIN, ACCOUNTANT, TEACHER, STUDENT, PARENT
from apps.accounts.models import User, normalize_phone
from apps.accounts.services import issue_invitation
from apps.audit.services import audit
from .models import Student, ParentLink
from .serializers import StudentSerializer, ParentLinkSerializer


@extend_schema(
    parameters=[
        OpenApiParameter(
            "has_certificate", bool, description="Haqiqiy rasmli sertifikati bor/yo‘q o‘quvchilar"
        ),
        OpenApiParameter("certificate_subject", int, description="Sertifikat fani ID"),
    ]
)
class StudentViewSet(ManagedViewSet):
    queryset = Student.objects.all()
    serializer_class = StudentSerializer
    read_roles = (OWNER, ADMIN, ACCOUNTANT, TEACHER, STUDENT, PARENT)
    search_fields = ["full_name", "phone", "contact_phone"]
    filterset_fields = ["status", "user"]

    def get_queryset(self):
        user = self.request.user
        queryset = student_scope(user).order_by("-id")
        params = self.request.query_params
        certificate_role = has_role(user, OWNER, ADMIN, TEACHER)
        if ("has_certificate" in params or "certificate_subject" in params) and not certificate_role:
            raise PermissionDenied("Sertifikat filtri administrator, rahbar va o‘qituvchi uchun.")
        if certificate_role:
            certificates = student_certificates(user)
            matching = certificates.filter(student_id=OuterRef("pk"))
            if subject := params.get("certificate_subject"):
                matching = matching.filter(
                    subject_id=serializers.IntegerField(min_value=1).run_validation(subject)
                )
            if params.get("has_certificate") or subject:
                has_certificate = serializers.BooleanField().run_validation(
                    params.get("has_certificate", True)
                )
                queryset = queryset.annotate(_has_certificate=Exists(matching)).filter(
                    _has_certificate=has_certificate
                )
            queryset = queryset.prefetch_related(
                Prefetch("certificates", queryset=certificates, to_attr="certificate_summary")
            )
        return queryset

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def account(self, request, pk=None):
        student = self.get_object()
        if student.user_id:
            raise ValidationError(
                "Akkaunt allaqachon biriktirilgan. Taklifni qayta chiqarishdan foydalaning."
            )
        user = User.objects.create_user(
            normalize_phone(request.data.get("phone", "")), full_name=student.full_name, roles=["STUDENT"]
        )
        student.user = user
        student.save()
        audit(request.user, "account.created", user, after={"student": student.pk})
        return Response(
            {"user_id": user.pk, "code": issue_invitation(request.user, user), "expires_in_hours": 24},
            status=201,
        )

    @action(detail=True, methods=["post"])
    def invitation(self, request, pk=None):
        student = self.get_object()
        if not student.user_id:
            raise ValidationError("Avval o‘quvchi uchun kabinet akkaunti yarating.")
        return Response(
            {
                "code": issue_invitation(request.user, student.user, request.data.get("purpose", "RESET")),
                "user_id": student.user_id,
                "phone": student.user.phone,
                "expires_in_hours": 24,
            }
        )


class ParentLinkViewSet(ManagedViewSet):
    queryset = ParentLink.objects.select_related("parent", "student")
    serializer_class = ParentLinkSerializer
    read_roles = (OWNER, ADMIN, PARENT)
    filterset_fields = ["student", "parent"]

    def get_queryset(self):
        qs = super().get_queryset()
        return qs if has_role(self.request.user, OWNER, ADMIN) else qs.filter(parent=self.request.user)

    @transaction.atomic
    def perform_create(self, serializer):
        if "PARENT" not in serializer.validated_data["parent"].roles:
            raise ValidationError("Tanlangan akkaunt ota-ona roliga ega emas.")
        obj = serializer.save(verified_by=self.request.user)
        audit(
            self.request.user,
            "parent.linked",
            obj,
            after={"student": obj.student_id, "parent": obj.parent_id},
        )

    def partial_update(self, *args, **kwargs):
        raise ValidationError("Bog‘lanishni ajrating va yangi tasdiqlangan bog‘lanish yarating.")

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def unlink(self, request, pk=None):
        link = self.get_object()
        reason = request.data.get("reason", "").strip()
        if not reason:
            raise ValidationError("Ajratish sababi kerak.")
        audit(
            request.user,
            "parent.unlinked",
            link,
            before={"student": link.student_id, "parent": link.parent_id},
            reason=reason,
        )
        link.delete()
        return Response({"message": "Bog‘lanish ajratildi."})
