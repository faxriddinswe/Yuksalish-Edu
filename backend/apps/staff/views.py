from django.db import transaction
from rest_framework import serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from common.views import ManagedViewSet
from common.serializers import serializer_for
from common.permissions import has_role, OWNER, ADMIN, ACCOUNTANT, TEACHER, MANAGEMENT_ROLES
from apps.accounts.models import User, ROLES, EXTRA_PERMISSIONS
from apps.accounts.services import issue_invitation
from .models import TeacherProfile


class UserSerializer(serializers.ModelSerializer):
    roles = serializers.ListField(child=serializers.ChoiceField(choices=ROLES), required=False)
    extra_permissions = serializers.ListField(
        child=serializers.ChoiceField(choices=EXTRA_PERMISSIONS), required=False
    )

    class Meta:
        model = User
        fields = [
            "id",
            "full_name",
            "phone",
            "roles",
            "extra_permissions",
            "is_active",
            "activated_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["activated_at", "created_at", "updated_at"]

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)

    def validate(self, attrs):
        actor = self.context["request"].user
        if not has_role(actor, OWNER):
            if self.instance and OWNER in self.instance.roles:
                raise PermissionDenied("Rahbar akkauntini faqat rahbar boshqaradi.")
            if OWNER in attrs.get("roles", []):
                raise PermissionDenied("Rahbar rolini faqat rahbar bera oladi.")
            if (
                self.instance
                and self.instance.pk == actor.pk
                and set(attrs.get("roles", actor.roles)) != set(actor.roles)
            ):
                raise PermissionDenied("O‘z rolingizni o‘zgartirish uchun rahbarga murojaat qiling.")
            existing = self.instance.extra_permissions if self.instance else []
            if set(attrs.get("extra_permissions", existing)) != set(existing):
                raise PermissionDenied("Qo‘shimcha istisno vakolatlarini faqat rahbar o‘zgartiradi.")
        return attrs


class StaffViewSet(ManagedViewSet):
    queryset = User.objects.filter(is_test_account=False)
    serializer_class = UserSerializer
    read_roles = (OWNER, ADMIN)
    write_roles = (OWNER, ADMIN)
    search_fields = ["full_name", "phone"]
    filterset_fields = ["is_active"]

    @action(detail=True, methods=["post"])
    def invitation(self, request, pk=None):
        user = self.get_object()
        return Response(
            {
                "code": issue_invitation(request.user, user, request.data.get("purpose", "ACTIVATE")),
                "user_id": user.pk,
                "expires_in_hours": 24,
            }
        )

    def check_permissions(self, request):
        if getattr(self, "action", "") == "invitation" and has_role(request.user, OWNER, ADMIN):
            return
        return super().check_permissions(request)

    def get_queryset(self):
        qs = super().get_queryset()
        if role := self.request.query_params.get("role"):
            if role not in ROLES:
                raise serializers.ValidationError("Rol noto‘g‘ri.")
            qs = qs.filter(roles__contains=[role])
        return qs

    @transaction.atomic
    def perform_update(self, serializer):
        if (
            serializer.instance.pk == self.request.user.pk
            and OWNER in serializer.instance.roles
            and OWNER not in serializer.validated_data.get("roles", serializer.instance.roles)
        ):
            raise serializers.ValidationError("O‘z rahbar rolingizni bu yerdan olib tashlay olmaysiz.")
        if serializer.instance.pk == self.request.user.pk and (
            serializer.validated_data.get("is_active") is False
            or not MANAGEMENT_ROLES.intersection(
                serializer.validated_data.get("roles", serializer.instance.roles)
            )
        ):
            raise serializers.ValidationError(
                "O‘z boshqaruv huquqingizni yoki faolligingizni olib tashlay olmaysiz."
            )
        super().perform_update(serializer)

    def perform_destroy(self, instance):
        if instance.pk == self.request.user.pk:
            raise serializers.ValidationError("O‘z akkauntingizni shu yerdan o‘chira olmaysiz.")
        if OWNER in instance.roles and not has_role(self.request.user, OWNER):
            raise PermissionDenied("Rahbar akkauntini faqat rahbar boshqaradi.")
        super().perform_destroy(instance)


class ParentViewSet(StaffViewSet):
    read_roles = (OWNER, ADMIN)
    write_roles = (OWNER, ADMIN)

    def get_queryset(self):
        return User.objects.filter(roles__contains=["PARENT"])

    def perform_create(self, serializer):
        if not has_role(self.request.user, OWNER):
            serializer.validated_data["roles"] = ["PARENT"]
            serializer.validated_data["extra_permissions"] = []
        super().perform_create(serializer)

    def perform_update(self, serializer):
        if not has_role(self.request.user, OWNER):
            if set(serializer.instance.roles) - {"PARENT"}:
                raise PermissionDenied()
            serializer.validated_data.pop("roles", None)
            serializer.validated_data.pop("extra_permissions", None)
        super().perform_update(serializer)


BaseTeacherSerializer = serializer_for(
    TeacherProfile,
    [
        "user",
        "full_name",
        "slug",
        "subjects",
        "biography",
        "experience_years",
        "students_taught",
        "qualifications",
        "photo",
        "public_phone",
        "publication_status",
        "is_active",
    ],
)


class TeacherSerializer(BaseTeacherSerializer):
    def validate_user(self, value):
        if not value.is_active or TEACHER not in value.roles:
            raise serializers.ValidationError("Faol o‘qituvchi akkauntini tanlang.")
        return value


class TeacherViewSet(ManagedViewSet):
    queryset = TeacherProfile.objects.select_related("user").prefetch_related("subjects")
    serializer_class = TeacherSerializer
    read_roles = (OWNER, ADMIN, ACCOUNTANT, TEACHER)
    search_fields = ["full_name"]
    filterset_fields = ["is_active", "publication_status", "subjects"]

    def get_queryset(self):
        qs = super().get_queryset()
        return (
            qs.filter(user=self.request.user)
            if not has_role(self.request.user, OWNER, ADMIN, ACCOUNTANT)
            else qs
        )
