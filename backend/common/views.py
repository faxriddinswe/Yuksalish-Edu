from django.db import transaction
from django.db.models.deletion import ProtectedError, RestrictedError
from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from apps.audit.services import audit
from common.permissions import has_role, allowed, OWNER, ADMIN


class ManagedViewSet(viewsets.ModelViewSet):
    lookup_value_regex = r"\d+"
    write_roles = (OWNER, ADMIN)
    read_roles = (OWNER, ADMIN)
    read_permission = ""
    http_method_names = ["get", "post", "patch", "put", "delete", "head", "options"]
    ordering_fields = ["id", "created_at"]
    ordering = ["-id"]

    def check_permissions(self, request):
        super().check_permissions(request)
        roles = self.read_roles if request.method in ["GET", "HEAD", "OPTIONS"] else self.write_roles
        delegated_read = (
            request.method in ["GET", "HEAD", "OPTIONS"]
            and self.read_permission
            and allowed(request.user, self.read_permission)
        )
        if not has_role(request.user, *roles) and not delegated_read:
            raise PermissionDenied()

    @transaction.atomic
    def perform_create(self, serializer):
        obj = serializer.save()
        obj.full_clean()
        audit(
            self.request.user,
            "record.created",
            obj,
            after={k: str(v) for k, v in serializer.validated_data.items() if k not in ["image", "photo"]},
        )

    @transaction.atomic
    def perform_update(self, serializer):
        obj = serializer.instance
        before = {k: str(getattr(obj, k, "")) for k in serializer.validated_data}
        obj = serializer.save()
        obj.full_clean()
        audit(
            self.request.user,
            "record.changed",
            obj,
            before=before,
            after={k: str(v) for k, v in serializer.validated_data.items() if k not in ["image", "photo"]},
        )

    def partial_update(self, request, *args, **kwargs):
        if getattr(self, "immutable", False):
            raise ValidationError("Bu yozuv o‘zgarmaydi; yangi tarixiy yozuv yarating.")
        return super().partial_update(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if getattr(self, "immutable", False):
            raise ValidationError("Bu yozuv o‘zgarmaydi; yangi tarixiy yozuv yarating.")
        return super().update(request, *args, **kwargs)

    @transaction.atomic
    def perform_destroy(self, instance):
        if not has_role(self.request.user, OWNER, ADMIN):
            raise PermissionDenied()
        if getattr(self, "immutable", False):
            raise ValidationError("Tarixiy yozuv o‘chirilmaydi; tegishli bekor qilish amalidan foydalaning.")
        audit(self.request.user, "record.deleted", instance, before={"label": str(instance)})
        try:
            instance.delete()
        except (ProtectedError, RestrictedError):
            raise ValidationError(
                "Bu yozuv hisoblar yoki boshqa tarixiy ma’lumotlarga bog‘langan. "
                "Uni nofaol/arxiv holatiga o‘tkazing yoki tegishli bekor qilish amalidan foydalaning."
            )
