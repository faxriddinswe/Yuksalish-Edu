from common.views import ManagedViewSet
from common.serializers import serializer_for
from common.permissions import OWNER, ADMIN, TEACHER, has_role
from django.db import transaction
from django.db.models import Q
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from drf_spectacular.utils import extend_schema
from apps.audit.services import audit
from apps.staff.models import TeacherProfile
from apps.students.models import Student
from apps.education.models import Subject, Enrollment
from apps.education.serializers import SubjectSerializer
from rest_framework import serializers
from .models import SiteSettings, FAQ, Achievement
from .scopes import achievement_scope, teacher_students

SettingsSerializer = serializer_for(
    SiteSettings,
    [
        "name",
        "about",
        "public_phone",
        "address",
        "working_hours",
        "map_url",
        "telegram_url",
        "instagram_url",
        "linkedin_url",
        "announcement",
        "headline",
        "introduction",
        "mission",
        "teaching_approach",
        "facilities",
        "admission_steps",
        "cover_image",
        "about_image",
        "image_caption",
    ],
    ["name"],
)
FAQSerializer = serializer_for(FAQ, ["question", "answer", "position", "publication_status"])
BaseAchievementSerializer = serializer_for(
    Achievement,
    [
        "display_name",
        "title",
        "description",
        "score",
        "is_sample",
        "student",
        "subject",
        "teacher",
        "achieved_on",
        "image",
        "consent_record",
        "privacy_reviewed",
        "publication_status",
    ],
)


class AchievementSerializer(BaseAchievementSerializer):
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    teacher_name = serializers.CharField(source="teacher.full_name", read_only=True, default="")
    student_name = serializers.CharField(source="student.full_name", read_only=True, default="")

    class Meta(BaseAchievementSerializer.Meta):
        fields = [*BaseAchievementSerializer.Meta.fields, "subject_name", "teacher_name", "student_name"]

    def get_fields(self):
        fields = super().get_fields()
        request = self.context.get("request")
        if request and request.user.is_authenticated and not has_role(request.user, OWNER, ADMIN):
            fields["teacher"].queryset = TeacherProfile.objects.filter(user=request.user)
            students = teacher_students(request.user)
            subjects = Subject.objects.filter(teacherprofile__user=request.user)
            if isinstance(self.instance, Achievement):
                students = Student.objects.filter(Q(pk__in=students) | Q(pk=self.instance.student_id))
                subjects = Subject.objects.filter(Q(pk__in=subjects) | Q(pk=self.instance.subject_id))
            fields["student"].queryset = students
            fields["subject"].queryset = subjects
        return fields

    def validate(self, attrs):
        attrs = super().validate(attrs)
        subject = attrs.get("subject", getattr(self.instance, "subject", None))
        teacher = attrs.get("teacher", getattr(self.instance, "teacher", None))
        student = attrs.get("student", getattr(self.instance, "student", None))
        request = self.context.get("request")
        teacher_actor = request and not has_role(request.user, OWNER, ADMIN)
        if teacher_actor:
            own_teacher = TeacherProfile.objects.filter(user=request.user, is_active=True).first()
            if not own_teacher:
                raise PermissionDenied("Sertifikat kiritish uchun faol ustoz profilingiz kerak.")
            if teacher and teacher.pk != own_teacher.pk:
                raise PermissionDenied("Faqat o‘zingiz tayyorlagan natijani boshqaring.")
            teacher = attrs["teacher"] = own_teacher
            if not student:
                raise serializers.ValidationError({"student": "Sertifikat olgan o‘quvchini tanlang."})
        changed_link = self.instance is None or any(
            getattr(self.instance, f"{field}_id") != (value.pk if value else None)
            for field, value in [("subject", subject), ("teacher", teacher), ("student", student)]
        )
        if changed_link and teacher and subject and not teacher.subjects.filter(pk=subject.pk).exists():
            raise serializers.ValidationError({"teacher": "Ustoz tanlangan fan bo‘yicha biriktirilmagan."})
        if (
            teacher_actor
            and changed_link
            and not Enrollment.objects.filter(
                student=student, group__teacher=teacher, group__course__subject=subject
            ).exists()
        ):
            raise serializers.ValidationError(
                {"student": "O‘quvchi ushbu fandan sizning guruhingizga biriktirilmagan."}
            )
        if (
            attrs.get("publication_status", getattr(self.instance, "publication_status", "DRAFT"))
            == "PUBLISHED"
        ):
            if not attrs.get("image", getattr(self.instance, "image", None)):
                raise serializers.ValidationError(
                    {"image": "E’lon qilish uchun sertifikat yoki natija rasmini yuklang."}
                )
        return attrs


class SettingsViewSet(ManagedViewSet):
    queryset = SiteSettings.objects.all()
    serializer_class = SettingsSerializer
    write_roles = (OWNER, ADMIN)

    def perform_create(self, serializer):
        from rest_framework.exceptions import ValidationError

        if SiteSettings.objects.exists():
            raise ValidationError("Markaz sozlamalari allaqachon mavjud.")
        super().perform_create(serializer)


class FAQViewSet(ManagedViewSet):
    queryset = FAQ.objects.all()
    serializer_class = FAQSerializer
    write_roles = (OWNER, ADMIN)


class AchievementViewSet(ManagedViewSet):
    queryset = Achievement.objects.select_related("subject", "teacher")
    serializer_class = AchievementSerializer
    read_roles = (OWNER, ADMIN, TEACHER)
    write_roles = (OWNER, ADMIN, TEACHER)
    search_fields = [
        "display_name",
        "title",
        "description",
        "teacher__full_name",
        "student__full_name",
        "score",
    ]
    filterset_fields = ["subject", "teacher", "student", "publication_status", "is_sample"]

    def get_queryset(self):
        return achievement_scope(self.request.user)

    @extend_schema(responses=SubjectSerializer(many=True))
    @action(detail=False, methods=["get"], filter_backends=[], serializer_class=SubjectSerializer)
    def subjects(self, request):
        queryset = Subject.objects.order_by("name")
        if not has_role(request.user, OWNER, ADMIN):
            queryset = queryset.filter(teacherprofile__user=request.user)
        if search := request.query_params.get("search", "").strip():
            queryset = queryset.filter(name__icontains=search)
        page = self.paginate_queryset(queryset)
        return self.get_paginated_response(SubjectSerializer(page, many=True).data)

    @transaction.atomic
    def perform_destroy(self, instance):
        # The queryset already limits a teacher to their own certificates.
        audit(
            self.request.user,
            "record.deleted",
            instance,
            before={
                "title": instance.title,
                "student": instance.student_id,
                "subject": instance.subject_id,
                "teacher": instance.teacher_id,
            },
        )
        instance.delete()

    def perform_create(self, serializer):
        self.validate_consent(serializer)
        super().perform_create(serializer)

    def perform_update(self, serializer):
        self.validate_consent(serializer)
        super().perform_update(serializer)

    def validate_consent(self, serializer):
        from rest_framework.exceptions import ValidationError

        data = serializer.validated_data
        instance = serializer.instance

        def get(k):
            return data.get(k, getattr(instance, k, None))

        if get("publication_status") == "PUBLISHED" and (
            not get("privacy_reviewed") or not get("consent_record")
        ):
            raise ValidationError("E’lon qilish uchun rozilik qaydi va maxfiylik tekshiruvi kerak.")
