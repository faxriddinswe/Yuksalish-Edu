from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field
from common.serializers import serializer_for
from common.permissions import has_role, private_student_scope, OWNER, ADMIN, TEACHER
from apps.content.models import Achievement
from .models import Student, ParentLink

BaseStudentSerializer = serializer_for(
    Student,
    ["full_name", "phone", "contact_phone", "user", "registered_on", "status", "internal_notes"],
    ["user"],
)


class StudentCertificateSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    teacher_name = serializers.CharField(source="teacher.full_name", read_only=True, default="")

    class Meta:
        model = Achievement
        fields = [
            "id",
            "title",
            "score",
            "subject",
            "subject_name",
            "teacher_name",
            "achieved_on",
            "publication_status",
        ]


class StudentSerializer(BaseStudentSerializer):
    certificates = serializers.SerializerMethodField()
    certificate_count = serializers.SerializerMethodField()

    class Meta(BaseStudentSerializer.Meta):
        fields = [*BaseStudentSerializer.Meta.fields, "certificates", "certificate_count"]

    @extend_schema_field(StudentCertificateSerializer(many=True))
    def get_certificates(self, obj):
        return StudentCertificateSerializer(getattr(obj, "certificate_summary", []), many=True).data

    def get_certificate_count(self, obj) -> int:
        return len(getattr(obj, "certificate_summary", []))

    def to_representation(self, instance):
        data = super().to_representation(instance)
        user = self.context["request"].user
        if not has_role(user, OWNER, ADMIN, TEACHER):
            data.pop("certificates", None)
            data.pop("certificate_count", None)
        if not has_role(user, OWNER, ADMIN):
            data.pop("internal_notes", None)
        if not has_role(user, OWNER, ADMIN, "ACCOUNTANT"):
            if not hasattr(self, "_private_ids"):
                self._private_ids = set(private_student_scope(user).values_list("id", flat=True))
        if not has_role(user, OWNER, ADMIN, "ACCOUNTANT") and instance.pk not in self._private_ids:
            data.pop("phone", None)
            data.pop("contact_phone", None)
            data.pop("user", None)
        return data


BaseParentLinkSerializer = serializer_for(
    ParentLink, ["parent", "student", "relationship", "verified_by"], ["verified_by"]
)


class ParentLinkSerializer(BaseParentLinkSerializer):
    student_name = serializers.CharField(source="student.full_name", read_only=True)
    parent_name = serializers.CharField(source="parent.full_name", read_only=True)

    class Meta(BaseParentLinkSerializer.Meta):
        fields = [*BaseParentLinkSerializer.Meta.fields, "student_name", "parent_name"]
