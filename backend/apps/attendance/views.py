from rest_framework import serializers, viewsets
from rest_framework.response import Response
from rest_framework.decorators import action
from drf_spectacular.utils import extend_schema, inline_serializer
from django.db.models import Q
from common.serializers import serializer_for
from common.permissions import (
    has_role,
    allowed,
    private_student_scope,
    OWNER,
    ADMIN,
    TEACHER,
    STUDENT,
    PARENT,
)
from rest_framework.exceptions import PermissionDenied
from .models import Attendance
from .services import mark_attendance, confirm_unmarked_present
from apps.education.models import Lesson

BaseSerializer = serializer_for(
    Attendance,
    ["lesson", "student", "enrollment", "status", "note", "marked_by"],
    ["enrollment", "marked_by"],
)


class AttendanceSerializer(BaseSerializer):
    student_name = serializers.CharField(source="student.full_name", read_only=True)
    lesson_date = serializers.DateTimeField(source="lesson.starts_at", read_only=True)
    group_name = serializers.CharField(source="lesson.group.name", read_only=True)
    course_name = serializers.CharField(source="lesson.group.course.name", read_only=True)

    class Meta(BaseSerializer.Meta):
        fields = [*BaseSerializer.Meta.fields, "student_name", "lesson_date", "group_name", "course_name"]


class AttendanceWriteSerializer(BaseSerializer):
    reason = serializers.CharField(required=False, allow_blank=True, max_length=500)

    class Meta(BaseSerializer.Meta):
        # POST is an intentional upsert; uniqueness remains enforced by the DB.
        validators = []
        fields = [*BaseSerializer.Meta.fields, "reason"]


class ConfirmPresentSerializer(serializers.Serializer):
    lesson = serializers.PrimaryKeyRelatedField(queryset=Lesson.objects.all())


class AttendanceViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AttendanceSerializer
    filterset_fields = ["lesson", "student", "status"]
    ordering = ["-lesson__starts_at", "student__full_name", "-id"]

    def check_permissions(self, request):
        super().check_permissions(request)
        if request.method not in ["GET", "HEAD", "OPTIONS"] and not allowed(
            request.user, "attendance.correct_attendance", TEACHER
        ):
            raise PermissionDenied()
        if not has_role(request.user, OWNER, ADMIN, TEACHER, STUDENT, PARENT) and not allowed(
            request.user, "attendance.correct_attendance"
        ):
            raise PermissionDenied()

    def get_serializer_class(self):
        return AttendanceWriteSerializer if self.action == "create" else AttendanceSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Attendance.objects.select_related("student", "lesson__group__course")
        if has_role(user, OWNER, ADMIN):
            result = qs
        else:
            q = Q(student__in=private_student_scope(user))
            if has_role(user, TEACHER):
                q |= Q(lesson__teacher__user=user)
            result = qs.filter(q).distinct()
        for param, field in [
            ("from", "lesson__starts_at__date__gte"),
            ("to", "lesson__starts_at__date__lte"),
        ]:
            if value := self.request.query_params.get(param):
                result = result.filter(**{field: serializers.DateField().run_validation(value)})
        return result

    def create(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        obj = mark_attendance(
            request.user,
            data["lesson"],
            data["student"],
            data["status"],
            data.get("note", ""),
            request.data.get("reason", ""),
        )
        return Response(AttendanceSerializer(obj).data, status=201)

    @extend_schema(
        request=ConfirmPresentSerializer,
        responses=inline_serializer("ConfirmedPresentCount", fields={"created": serializers.IntegerField()}),
    )
    @action(detail=False, methods=["post"], url_path="confirm-present")
    def confirm_present(self, request):
        serializer = ConfirmPresentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        count = confirm_unmarked_present(request.user, serializer.validated_data["lesson"])
        return Response({"created": count})
