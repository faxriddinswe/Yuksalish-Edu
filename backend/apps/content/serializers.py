from rest_framework import serializers
from common.serializers import serializer_for
from apps.staff.models import TeacherProfile
from .models import Achievement


BasePublicTeacherSerializer = serializer_for(
    TeacherProfile,
    [
        "full_name",
        "slug",
        "subjects",
        "biography",
        "photo",
        "public_phone",
        "experience_years",
        "qualifications",
    ],
    name="PublicTeacherSerializer",
)


class PublicTeacherSerializer(BasePublicTeacherSerializer):
    subject_names = serializers.SlugRelatedField(
        source="subjects", slug_field="name", read_only=True, many=True
    )
    student_count = serializers.SerializerMethodField()

    class Meta(BasePublicTeacherSerializer.Meta):
        fields = [*BasePublicTeacherSerializer.Meta.fields, "subject_names", "student_count"]

    def get_student_count(self, obj) -> int:
        # An approved lifetime total may include teaching before the CRM existed.
        # Never add it to the CRM count, which could count the same people twice.
        return obj.students_taught if obj.students_taught is not None else obj.recorded_student_count


BasePublicAchievementSerializer = serializer_for(
    Achievement,
    [
        "display_name",
        "title",
        "description",
        "score",
        "is_sample",
        "subject",
        "teacher",
        "image",
        "achieved_on",
    ],
    name="PublicAchievementSerializer",
)


class PublicAchievementSerializer(BasePublicAchievementSerializer):
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    teacher_name = serializers.CharField(source="teacher.full_name", read_only=True, default="")

    class Meta(BasePublicAchievementSerializer.Meta):
        fields = [*BasePublicAchievementSerializer.Meta.fields, "subject_name", "teacher_name"]
