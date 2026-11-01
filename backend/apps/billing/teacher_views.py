from django.shortcuts import get_object_or_404
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema, inline_serializer, OpenApiParameter

from common.permissions import has_role, OWNER, ACCOUNTANT
from apps.staff.models import TeacherProfile
from .models import TeacherPayment
from .serializers import TeacherPaymentSerializer, TeacherPaymentRequest
from .teacher_payments import record_teacher_payment, void_teacher_payment


class TeacherPaymentViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = TeacherPaymentSerializer
    filterset_fields = ["teacher", "month", "status"]
    search_fields = ["teacher__full_name"]
    ordering_fields = ["paid_on", "id", "month", "amount"]
    ordering = ["-paid_on", "-id"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return TeacherPayment.objects.none()
        if not has_role(self.request.user, OWNER, ACCOUNTANT):
            raise PermissionDenied()
        return TeacherPayment.objects.select_related("teacher", "entered_by")

    @extend_schema(
        request=TeacherPaymentRequest,
        responses={200: TeacherPaymentSerializer, 201: TeacherPaymentSerializer},
        parameters=[OpenApiParameter("Idempotency-Key", str, OpenApiParameter.HEADER, required=True)],
    )
    def create(self, request):
        if not has_role(request.user, OWNER, ACCOUNTANT):
            raise PermissionDenied()
        serializer = TeacherPaymentRequest(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        teacher = get_object_or_404(TeacherProfile, pk=data.pop("teacher"))
        payment, created = record_teacher_payment(
            request.user, teacher, **data, key=request.headers.get("Idempotency-Key")
        )
        return Response(self.get_serializer(payment).data, status=201 if created else 200)

    @extend_schema(
        request=inline_serializer(
            "VoidTeacherPaymentRequest", fields={"reason": serializers.CharField(max_length=2000)}
        ),
        responses=TeacherPaymentSerializer,
    )
    @action(detail=True, methods=["post"])
    def void(self, request, pk=None):
        reason = serializers.CharField(max_length=2000).run_validation(request.data.get("reason"))
        return Response(
            self.get_serializer(void_teacher_payment(request.user, self.get_object(), reason)).data
        )
