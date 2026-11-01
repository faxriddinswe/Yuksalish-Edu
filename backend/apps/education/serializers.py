from rest_framework import serializers
from common.serializers import serializer_for
from .models import Subject, SubjectPrice, Course, Room, StudyGroup, Enrollment, ScheduleRule, Lesson

SubjectSerializer = serializer_for(Subject, ["name", "slug", "is_active"])
PriceSerializer = serializer_for(SubjectPrice, ["subject", "amount", "effective_from"])
BaseCourseSerializer = serializer_for(
    Course,
    [
        "subject",
        "name",
        "slug",
        "summary",
        "description",
        "audience",
        "duration",
        "lesson_description",
        "teachers",
        "featured",
        "publication_status",
        "is_active",
    ],
)


class CourseSerializer(BaseCourseSerializer):
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    monthly_price = serializers.SerializerMethodField()

    class Meta(BaseCourseSerializer.Meta):
        fields = [*BaseCourseSerializer.Meta.fields, "subject_name", "monthly_price"]

    def get_monthly_price(self, obj) -> str | None:
        from django.utils import timezone

        # Prefetch prices on list endpoints to avoid N+1.
        prices = [p for p in obj.subject.prices.all() if p.effective_from <= timezone.localdate()]
        return str(max(prices, key=lambda p: p.effective_from).amount) if prices else None


RoomSerializer = serializer_for(Room, ["name", "capacity", "is_active"])
BaseGroupSerializer = serializer_for(
    StudyGroup, ["name", "course", "teacher", "room", "capacity", "start_date", "end_date", "status"]
)


class GroupSerializer(BaseGroupSerializer):
    course_name = serializers.CharField(source="course.name", read_only=True)
    teacher_name = serializers.CharField(source="teacher.full_name", read_only=True)
    room_name = serializers.CharField(source="room.name", read_only=True)
    student_count = serializers.IntegerField(read_only=True, default=0)

    class Meta(BaseGroupSerializer.Meta):
        fields = [
            *BaseGroupSerializer.Meta.fields,
            "course_name",
            "teacher_name",
            "room_name",
            "student_count",
        ]


class GroupParentContactSerializer(serializers.Serializer):
    name = serializers.CharField(source="parent.full_name")
    phone = serializers.CharField(source="parent.phone")
    relationship = serializers.CharField()


class GroupMemberSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.full_name")
    student_phone = serializers.CharField(source="student.phone")
    contact_phone = serializers.CharField(source="student.contact_phone")
    registered_on = serializers.DateField(source="student.registered_on")
    parents = GroupParentContactSerializer(source="student.parent_links", many=True)

    class Meta:
        model = Enrollment
        fields = [
            "id",
            "student",
            "student_name",
            "student_phone",
            "contact_phone",
            "registered_on",
            "start_date",
            "end_date",
            "status",
            "parents",
        ]


BaseEnrollmentSerializer = serializer_for(
    Enrollment, ["student", "group", "start_date", "end_date", "status"]
)


class EnrollmentSerializer(BaseEnrollmentSerializer):
    student_name = serializers.CharField(source="student.full_name", read_only=True)
    group_name = serializers.CharField(source="group.name", read_only=True)

    class Meta(BaseEnrollmentSerializer.Meta):
        fields = [*BaseEnrollmentSerializer.Meta.fields, "student_name", "group_name"]


RuleSerializer = serializer_for(
    ScheduleRule, ["group", "weekday", "start_time", "end_time", "valid_from", "valid_until"]
)
BaseLessonSerializer = serializer_for(Lesson, ["group", "room", "teacher", "starts_at", "ends_at", "status"])


class LessonSerializer(BaseLessonSerializer):
    group_name = serializers.CharField(source="group.name", read_only=True)
    room_name = serializers.CharField(source="room.name", read_only=True)
    teacher_name = serializers.CharField(source="teacher.full_name", read_only=True)

    class Meta(BaseLessonSerializer.Meta):
        fields = [*BaseLessonSerializer.Meta.fields, "group_name", "room_name", "teacher_name"]
