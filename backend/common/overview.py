from django.db.models import Count, Q, Exists, OuterRef
from django.utils import timezone
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from common.permissions import has_role, OWNER, ADMIN
from apps.students.models import Student
from apps.staff.models import TeacherProfile
from apps.education.models import StudyGroup, Lesson
from apps.leads.models import Lead
from apps.reports.selectors import financial_report
from apps.content.models import Achievement


class CenterOverviewView(APIView):
    @extend_schema(
        responses=inline_serializer(
            "CenterOverview",
            fields={
                "students_total": serializers.IntegerField(),
                "students_active": serializers.IntegerField(),
                "groups_active": serializers.IntegerField(),
                "teachers_active": serializers.IntegerField(),
                "pending_leads": serializers.IntegerField(),
                "lessons_today": serializers.IntegerField(),
                "certified_students": serializers.IntegerField(),
                "financial_summary": serializers.DictField(required=False),
            },
        )
    )
    def get(self, request):
        if not has_role(request.user, OWNER, ADMIN):
            raise PermissionDenied()
        counts = Student.objects.aggregate(
            students_total=Count("pk"), students_active=Count("pk", filter=Q(status="ACTIVE"))
        )
        data = {
            **counts,
            "groups_active": StudyGroup.objects.filter(status="ACTIVE").count(),
            "teachers_active": TeacherProfile.objects.filter(is_active=True).count(),
            "pending_leads": Lead.objects.filter(status="NEW").count(),
            "lessons_today": Lesson.objects.filter(starts_at__date=timezone.localdate())
            .exclude(status="CANCELLED")
            .count(),
            "certified_students": Student.objects.filter(
                Exists(
                    Achievement.objects.filter(student_id=OuterRef("pk"), is_sample=False).exclude(image="")
                )
            ).count(),
        }
        if has_role(request.user, OWNER):
            month = timezone.localdate().replace(day=1).isoformat()
            report = financial_report({"month": month})
            data["financial_summary"] = {key: report[key] for key in ["billed", "cash_received", "remaining"]}
        return Response(data)
