from rest_framework import serializers, viewsets
from common.permissions import OwnerOnly
from .models import AuditEvent


class AuditSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source="actor.full_name", read_only=True, default="Tizim")

    class Meta:
        model = AuditEvent
        fields = [
            "id",
            "actor",
            "actor_name",
            "action",
            "entity_type",
            "entity_id",
            "occurred_at",
            "before",
            "after",
            "reason",
            "request_id",
        ]


class AuditViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditEvent.objects.select_related("actor")
    serializer_class = AuditSerializer
    permission_classes = [OwnerOnly]
    filterset_fields = ["action", "entity_type", "actor"]
    search_fields = ["entity_id", "reason"]
