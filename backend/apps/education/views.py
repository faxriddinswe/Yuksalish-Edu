from django.db import transaction
from django.utils import timezone
from django.db.models import Q, Count, Prefetch
from rest_framework import serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from drf_spectacular.utils import extend_schema
from common.views import ManagedViewSet
from common.permissions import (
    has_role,
    private_student_scope,
    OWNER,
    ADMIN,
    ACCOUNTANT,
    TEACHER,
    STUDENT,
    PARENT,
)
from .models import Subject, SubjectPrice, Course, Room, StudyGroup, Enrollment, ScheduleRule, Lesson
from .serializers import (
    SubjectSerializer,
    PriceSerializer,
    CourseSerializer,
    RoomSerializer,
    GroupSerializer,
    EnrollmentSerializer,
    RuleSerializer,
    LessonSerializer,
    GroupMemberSerializer,
)
from .services import enroll, end_enrollment, transfer, generate_lessons, save_lesson


def group_scope(user):
    qs = StudyGroup.objects.select_related("course__subject", "teacher", "room")
    if has_role(user, OWNER, ADMIN, ACCOUNTANT):
        return qs
    q = Q(enrollments__student__in=private_student_scope(user))
    if has_role(user, TEACHER):
        q |= Q(teacher__user=user)
    return qs.filter(q).distinct()


class SubjectViewSet(ManagedViewSet):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer
    read_roles = (OWNER, ADMIN, ACCOUNTANT)
    search_fields = ["name"]


class PriceViewSet(ManagedViewSet):
    queryset = SubjectPrice.objects.select_related("subject")
    serializer_class = PriceSerializer
    read_roles = (OWNER, ADMIN, ACCOUNTANT)
    write_roles = (OWNER, ACCOUNTANT)
    filterset_fields = ["subject"]
    immutable = True


class CourseViewSet(ManagedViewSet):
    queryset = Course.objects.select_related("subject").prefetch_related("teachers", "subject__prices")
    serializer_class = CourseSerializer
    read_roles = (OWNER, ADMIN)
    search_fields = ["name", "summary"]
    filterset_fields = ["subject", "publication_status"]


class RoomViewSet(ManagedViewSet):
    queryset = Room.objects.all()
    serializer_class = RoomSerializer
    read_roles = (OWNER, ADMIN, TEACHER)
    search_fields = ["name"]


class GroupViewSet(ManagedViewSet):
    queryset = StudyGroup.objects.all()
    serializer_class = GroupSerializer
    read_roles = (OWNER, ADMIN, ACCOUNTANT, TEACHER, STUDENT, PARENT)
    search_fields = ["name", "course__name"]
    filterset_fields = ["status", "course", "teacher"]

    def get_queryset(self):
        today = timezone.localdate()
        return group_scope(self.request.user).annotate(
            student_count=Count(
                "enrollments__student",
                distinct=True,
                filter=Q(enrollments__status="ACTIVE", enrollments__start_date__lte=today)
                & (Q(enrollments__end_date__isnull=True) | Q(enrollments__end_date__gte=today)),
            )
        )

    @extend_schema(responses=GroupMemberSerializer(many=True))
    @action(detail=True, methods=["get"], filter_backends=[])
    def members(self, request, pk=None):
        from apps.students.models import ParentLink

        if not has_role(request.user, OWNER, ADMIN, TEACHER):
            raise PermissionDenied()
        group = self.get_object()
        if not has_role(request.user, OWNER, ADMIN) and group.teacher.user_id != request.user.pk:
            raise PermissionDenied()
        today = timezone.localdate()
        members = (
            Enrollment.objects.filter(group=group, status="ACTIVE", start_date__lte=today)
            .filter(Q(end_date__isnull=True) | Q(end_date__gte=today))
            .select_related("student")
            .prefetch_related(
                Prefetch("student__parent_links", queryset=ParentLink.objects.select_related("parent"))
            )
            .order_by("student__full_name", "student_id")
        )
        if search := request.query_params.get("search", "").strip():
            members = members.filter(
                Q(student__full_name__icontains=search)
                | Q(student__phone__icontains=search)
                | Q(student__contact_phone__icontains=search)
                | Q(student__parent_links__parent__phone__icontains=search)
                | Q(student__parent_links__parent__full_name__icontains=search)
            ).distinct()
        page = self.paginate_queryset(members)
        return self.get_paginated_response(GroupMemberSerializer(page, many=True).data)

    @transaction.atomic
    def perform_update(self, serializer):
        if any(
            k in serializer.validated_data
            and getattr(serializer.instance, k + "_id") != serializer.validated_data[k].pk
            for k in ["course", "teacher", "room"]
        ):
            raise serializers.ValidationError(
                "Tarixiy guruhning fan, ustoz va xonasini almashtirmang. Yangi guruh yoki alohida darsni ko‘chirishdan foydalaning."
            )
        super().perform_update(serializer)


class EnrollmentViewSet(ManagedViewSet):
    queryset = Enrollment.objects.all()
    serializer_class = EnrollmentSerializer
    read_roles = (OWNER, ADMIN, TEACHER, STUDENT, PARENT)
    filterset_fields = ["student", "group", "status"]
    immutable = True

    def get_queryset(self):
        qs = Enrollment.objects.select_related("student", "group")
        user = self.request.user
        if has_role(user, OWNER, ADMIN, ACCOUNTANT):
            return qs
        query = Q(student__in=private_student_scope(user))
        if has_role(user, TEACHER):
            query |= Q(group__teacher__user=user)
        return qs.filter(query).distinct()

    def perform_create(self, serializer):
        data = serializer.validated_data
        serializer.instance = enroll(self.request.user, data["student"], data["group"], data["start_date"])

    @action(detail=True, methods=["post"])
    def end(self, request, pk=None):
        obj = end_enrollment(
            request.user,
            self.get_object(),
            serializers.DateField().run_validation(request.data.get("end_date")),
            request.data.get("reason", ""),
        )
        return Response(self.get_serializer(obj).data)

    @action(detail=True, methods=["post"])
    def transfer(self, request, pk=None):
        try:
            group = StudyGroup.objects.get(pk=request.data.get("group"))
        except (StudyGroup.DoesNotExist, ValueError, TypeError):
            raise serializers.ValidationError("Yangi guruh topilmadi.")
        obj = transfer(
            request.user,
            self.get_object(),
            group,
            serializers.DateField().run_validation(request.data.get("on_date")),
            request.data.get("reason", ""),
        )
        return Response(self.get_serializer(obj).data)


class RuleViewSet(ManagedViewSet):
    queryset = ScheduleRule.objects.select_related("group__room", "group__teacher")
    serializer_class = RuleSerializer
    read_roles = (OWNER, ADMIN, TEACHER)
    filterset_fields = ["group"]
    immutable = True

    @action(detail=True, methods=["post"])
    def generate(self, request, pk=None):
        return Response({"created": generate_lessons(request.user, self.get_object())})

    def get_queryset(self):
        return super().get_queryset().filter(group__in=group_scope(self.request.user))


class LessonViewSet(ManagedViewSet):
    queryset = Lesson.objects.all()
    serializer_class = LessonSerializer
    read_roles = (OWNER, ADMIN, TEACHER, STUDENT, PARENT)
    read_permission = "attendance.correct_attendance"
    filterset_fields = ["group", "teacher", "status"]
    ordering_fields = ["starts_at", "id"]
    ordering = ["starts_at"]

    def get_queryset(self):
        scope = Q(group__in=group_scope(self.request.user))
        if has_role(self.request.user, TEACHER):
            scope |= Q(teacher__user=self.request.user)
        qs = Lesson.objects.filter(scope).select_related("group", "teacher", "room")
        if has_role(self.request.user, TEACHER) and not has_role(
            self.request.user, OWNER, ADMIN, ACCOUNTANT, STUDENT, PARENT
        ):
            qs = qs.filter(teacher__user=self.request.user)
        if student := self.request.query_params.get("student"):
            from common.permissions import student_scope
            from django.shortcuts import get_object_or_404

            selected = get_object_or_404(
                student_scope(self.request.user), pk=serializers.IntegerField().run_validation(student)
            )
            qs = qs.filter(group__enrollments__student=selected).distinct()
        for param, field in [("from", "starts_at__date__gte"), ("to", "starts_at__date__lte")]:
            if value := self.request.query_params.get(param):
                qs = qs.filter(**{field: serializers.DateField().run_validation(value)})
        return qs

    @action(detail=True, methods=["get"])
    def roster(self, request, pk=None):
        from django.db.models import OuterRef, Subquery
        from rest_framework.exceptions import PermissionDenied
        from apps.attendance.models import Attendance
        from common.permissions import allowed

        lesson = self.get_object()
        if not (
            has_role(request.user, OWNER, ADMIN)
            or (has_role(request.user, TEACHER) and lesson.teacher.user_id == request.user.pk)
            or allowed(request.user, "attendance.correct_attendance")
        ):
            raise PermissionDenied()
        day = timezone.localtime(lesson.starts_at).date()
        marks = Attendance.objects.filter(lesson=lesson, student_id=OuterRef("student_id"))
        qs = (
            Enrollment.objects.filter(group=lesson.group, start_date__lte=day)
            .filter(Q(end_date__isnull=True) | Q(end_date__gte=day))
            .select_related("student")
            .annotate(
                attendance_status=Subquery(marks.values("status")[:1]),
                attendance_note=Subquery(marks.values("note")[:1]),
            )
        )
        page = self.paginate_queryset(qs)
        return self.get_paginated_response(
            [
                {
                    "id": e.id,
                    "student": e.student_id,
                    "student_name": e.student.full_name,
                    "attendance_status": e.attendance_status,
                    "attendance_note": e.attendance_note,
                }
                for e in page
            ]
        )

    def perform_create(self, serializer):
        serializer.instance = save_lesson(self.request.user, serializer.validated_data)

    def perform_update(self, serializer):
        serializer.instance = save_lesson(
            self.request.user,
            serializer.validated_data,
            serializer.instance,
            self.request.data.get("reason", ""),
        )
