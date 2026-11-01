from pathlib import Path
from django.conf import settings
from django.http import FileResponse, Http404
from rest_framework import viewsets
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import PermissionDenied
from common.permissions import has_role, OWNER, ADMIN, ACCOUNTANT, TEACHER
from drf_spectacular.utils import extend_schema
from common.schema import object_schema
from common.serializers import serializer_for
from django.db.models import Count
from apps.education.models import Course, Subject
from apps.education.serializers import CourseSerializer
from apps.staff.models import TeacherProfile
from .models import SiteSettings, FAQ, Achievement
from .serializers import PublicTeacherSerializer, PublicAchievementSerializer
from .views import SettingsSerializer


class PublicSubjectViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Subject.objects.filter(is_active=True).order_by("name")
    serializer_class = serializer_for(Subject, ["name", "slug"], name="PublicSubjectSerializer")
    permission_classes = [AllowAny]
    http_method_names = ["get", "head", "options"]


class PublicCourseViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = (
        Course.objects.filter(publication_status="PUBLISHED", is_active=True, subject__is_active=True)
        .select_related("subject")
        .prefetch_related("teachers", "subject__prices")
    )
    serializer_class = CourseSerializer
    permission_classes = [AllowAny]
    lookup_field = "slug"
    search_fields = ["name", "summary"]
    filterset_fields = ["subject", "featured"]

    def list(self, *args, **kwargs):
        response = super().list(*args, **kwargs)
        # Public only; middleware conservatively applies no-store to every API.
        return response


class PublicTeacherViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = (
        TeacherProfile.objects.filter(publication_status="PUBLISHED", is_active=True)
        .prefetch_related("subjects")
        .annotate(recorded_student_count=Count("groups__enrollments__student_id", distinct=True))
        .order_by("full_name", "id")
    )
    serializer_class = PublicTeacherSerializer
    permission_classes = [AllowAny]
    lookup_field = "slug"
    search_fields = ["full_name", "biography", "qualifications"]
    filterset_fields = ["subjects"]


class PublicAchievementViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = (
        Achievement.objects.filter(publication_status="PUBLISHED", privacy_reviewed=True)
        .select_related("subject", "teacher")
        .exclude(consent_record="")
        .exclude(image="")
    )
    serializer_class = PublicAchievementSerializer
    permission_classes = [AllowAny]
    filterset_fields = ["subject", "teacher"]
    search_fields = ["display_name", "title", "description", "teacher__full_name"]
    ordering_fields = ["achieved_on", "created_at"]
    ordering = ["-achieved_on", "-id"]


class PublicSettingsView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        responses={
            200: {
                "type": "object",
                "properties": {
                    **object_schema(
                        name="string",
                        about="string",
                        public_phone="string",
                        address="string",
                        working_hours="string",
                        map_url="string",
                        telegram_url="string",
                        instagram_url="string",
                        linkedin_url="string",
                        announcement="string",
                        headline="string",
                        introduction="string",
                        mission="string",
                        teaching_approach="string",
                        facilities="string",
                        admission_steps="string",
                        cover_image="string",
                        about_image="string",
                        image_caption="string",
                    )["properties"],
                    "faqs": {
                        "type": "array",
                        "items": object_schema(id="integer", question="string", answer="string"),
                    },
                },
            }
        }
    )
    def get(self, request):
        obj = SiteSettings.objects.first()
        data = (
            SettingsSerializer(obj, context={"request": request}).data
            if obj
            else {
                "name": "Yuksalish Edu",
                "about": "Bilim va maqsad sari birga.",
                "public_phone": "",
                "address": "",
                "working_hours": "",
                "map_url": "",
                "telegram_url": "",
                "instagram_url": "",
                "linkedin_url": "",
                "announcement": "",
            }
        )
        data["faqs"] = list(
            FAQ.objects.filter(publication_status="PUBLISHED").values("id", "question", "answer")
        )
        return Response(data)


def public_media(request, path):
    # Only explicitly published images are reachable, including under DEBUG.
    if not (
        TeacherProfile.objects.filter(photo=path, publication_status="PUBLISHED", is_active=True).exists()
        or Achievement.objects.filter(image=path, publication_status="PUBLISHED", privacy_reviewed=True)
        .exclude(consent_record="")
        .exists()
        or SiteSettings.objects.filter(cover_image=path).exists()
        or SiteSettings.objects.filter(about_image=path).exists()
    ):
        raise Http404
    full = (Path(settings.MEDIA_ROOT) / path).resolve()
    if not full.is_relative_to(Path(settings.MEDIA_ROOT).resolve()) or not full.is_file():
        raise Http404
    response = FileResponse(full.open("rb"), content_type="image/jpeg")
    # Publication/consent may be revoked; never retain a reusable media response.
    response["Cache-Control"] = "no-store"
    return response


class ImagePreviewView(APIView):
    """Private preview for content editors, including images in drafts."""

    @extend_schema(responses={(200, "image/jpeg"): {"type": "string", "format": "binary"}})
    def get(self, request):
        if not has_role(request.user, OWNER, ADMIN, ACCOUNTANT, TEACHER):
            raise PermissionDenied()
        path = request.query_params.get("path", "")
        teachers = TeacherProfile.objects.filter(photo=path)
        if not has_role(request.user, OWNER, ADMIN, ACCOUNTANT):
            teachers = teachers.filter(user=request.user)
        can_view = teachers.exists()
        if has_role(request.user, OWNER, ADMIN):
            can_view = can_view or (
                Achievement.objects.filter(image=path).exists()
                or SiteSettings.objects.filter(cover_image=path).exists()
                or SiteSettings.objects.filter(about_image=path).exists()
            )
        elif has_role(request.user, TEACHER):
            can_view = can_view or Achievement.objects.filter(image=path, teacher__user=request.user).exists()
        if not path or not can_view:
            raise Http404
        full = (Path(settings.MEDIA_ROOT) / path).resolve()
        if not full.is_relative_to(Path(settings.MEDIA_ROOT).resolve()) or not full.is_file():
            raise Http404
        response = FileResponse(full.open("rb"), content_type="image/jpeg")
        response["Cache-Control"] = "no-store, private"
        return response
