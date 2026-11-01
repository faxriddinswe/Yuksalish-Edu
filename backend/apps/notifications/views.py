from django.utils import timezone
from rest_framework import viewsets, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from common.permissions import private_student_scope
from common.serializers import serializer_for
from drf_spectacular.utils import extend_schema, OpenApiParameter, inline_serializer
from apps.accounts.models import User
from .models import Notification, Broadcast
from .services import broadcast_message, broadcast_permission


class BroadcastRequestSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=180)
    message = serializers.CharField(max_length=5000)


class BroadcastSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source="sender.full_name", read_only=True)

    class Meta:
        model = Broadcast
        fields = ["id", "title", "message", "sender_name", "recipient_count", "created_at"]


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = serializer_for(
        Notification,
        ["student", "kind", "title", "message", "invoice", "lesson", "read_at", "resolved_at", "broadcast"],
    )
    filterset_fields = ["student", "kind"]
    ordering_fields = ["created_at", "id"]
    ordering = ["-created_at", "-id"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Notification.objects.none()
        qs = Notification.objects.filter(recipient=self.request.user).filter(
            Q(student__isnull=True) | Q(student__in=private_student_scope(self.request.user))
        )
        if self.request.query_params.get("unread") == "true":
            qs = qs.filter(read_at__isnull=True)
        return qs

    @extend_schema(
        responses=inline_serializer(
            "UnreadNotificationCount", fields={"unread_count": serializers.IntegerField()}
        )
    )
    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request):
        return Response({"unread_count": self.get_queryset().filter(read_at__isnull=True).count()})

    @extend_schema(
        methods=["GET"],
        responses=inline_serializer(
            "BroadcastAudience", fields={"recipient_count": serializers.IntegerField()}
        ),
    )
    @extend_schema(
        methods=["POST"],
        request=BroadcastRequestSerializer,
        parameters=[OpenApiParameter("Idempotency-Key", str, OpenApiParameter.HEADER, required=True)],
        responses={200: BroadcastSerializer, 201: BroadcastSerializer},
    )
    @action(detail=False, methods=["get", "post"])
    def broadcast(self, request):
        broadcast_permission(request.user)
        if request.method == "GET":
            return Response({"recipient_count": User.objects.filter(is_active=True).count()})
        serializer = BroadcastRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        key = serializers.UUIDField().run_validation(request.headers.get("Idempotency-Key"))
        obj, created = broadcast_message(request.user, **serializer.validated_data, key=key)
        return Response(BroadcastSerializer(obj).data, status=201 if created else 200)

    @extend_schema(responses=BroadcastSerializer(many=True))
    @action(detail=False, methods=["get"])
    def broadcasts(self, request):
        broadcast_permission(request.user)
        rows = Broadcast.objects.select_related("sender").order_by("-created_at", "-id")
        page = self.paginate_queryset(rows)
        return self.get_paginated_response(BroadcastSerializer(page, many=True).data)

    @action(detail=True, methods=["post"])
    def read(self, request, pk=None):
        obj = self.get_object()
        if obj.read_at is None:
            obj.read_at = timezone.now()
            obj.save(update_fields=["read_at"])
        return Response(self.get_serializer(obj).data)
