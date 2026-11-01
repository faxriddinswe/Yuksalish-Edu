from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from apps.accounts.views import SessionView, ActivateView, MeView
from apps.students.views import StudentViewSet, ParentLinkViewSet
from apps.staff.views import StaffViewSet, ParentViewSet, TeacherViewSet
from apps.staff.finance import TeacherFinanceViewSet
from apps.billing.teacher_views import TeacherPaymentViewSet
from apps.education.views import (
    SubjectViewSet,
    PriceViewSet,
    CourseViewSet,
    RoomViewSet,
    GroupViewSet,
    EnrollmentViewSet,
    RuleViewSet,
    LessonViewSet,
)
from apps.attendance.views import AttendanceViewSet
from apps.billing.views import InvoiceViewSet, PaymentViewSet, AdjustmentViewSet
from apps.leads.views import LeadViewSet, PublicLeadView
from apps.notifications.views import NotificationViewSet
from apps.content.views import SettingsViewSet, FAQViewSet, AchievementViewSet
from apps.content.public import (
    PublicCourseViewSet,
    PublicTeacherViewSet,
    PublicAchievementViewSet,
    PublicSettingsView,
    public_media,
    PublicSubjectViewSet,
    ImagePreviewView,
)
from apps.audit.views import AuditViewSet
from apps.reports.views import FinancialReportView, FinancialDownloadView, ExportViewSet
from common.health import HealthView, OperationsView
from common.overview import CenterOverviewView

router = DefaultRouter()
for prefix, view, basename in [
    ("students", StudentViewSet, "students"),
    ("parents", ParentViewSet, "parents"),
    ("parents/links", ParentLinkViewSet, "parent-links"),
    ("staff", StaffViewSet, "staff"),
    ("staff/teachers", TeacherViewSet, "teachers"),
    ("staff/teacher-finance", TeacherFinanceViewSet, "teacher-finance"),
    ("subjects", SubjectViewSet, "subjects"),
    ("subjects/prices", PriceViewSet, "prices"),
    ("courses", CourseViewSet, "courses"),
    ("rooms", RoomViewSet, "rooms"),
    ("groups", GroupViewSet, "groups"),
    ("enrollments", EnrollmentViewSet, "enrollments"),
    ("schedule", RuleViewSet, "schedule"),
    ("lessons", LessonViewSet, "lessons"),
    ("attendance", AttendanceViewSet, "attendance"),
    ("leads", LeadViewSet, "leads"),
    ("billing/invoices", InvoiceViewSet, "invoices"),
    ("billing/payments", PaymentViewSet, "payments"),
    ("billing/teacher-payments", TeacherPaymentViewSet, "teacher-payments"),
    ("billing/adjustments", AdjustmentViewSet, "adjustments"),
    ("notifications", NotificationViewSet, "notifications"),
    ("content/settings", SettingsViewSet, "settings"),
    ("content/faqs", FAQViewSet, "faqs"),
    ("content/achievements", AchievementViewSet, "achievements"),
    ("audit", AuditViewSet, "audit"),
    ("reports/exports", ExportViewSet, "exports"),
    ("public/courses", PublicCourseViewSet, "public-courses"),
    ("public/subjects", PublicSubjectViewSet, "public-subjects"),
    ("public/teachers", PublicTeacherViewSet, "public-teachers"),
    ("public/achievements", PublicAchievementViewSet, "public-achievements"),
]:
    router.register(prefix, view, basename=basename)
urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/auth/session/", SessionView.as_view()),
    path("api/v1/auth/activate/", ActivateView.as_view()),
    path("api/v1/me/", MeView.as_view()),
    path("api/v1/overview/", CenterOverviewView.as_view()),
    path("api/v1/public/settings/", PublicSettingsView.as_view()),
    path("api/v1/content/image-preview/", ImagePreviewView.as_view()),
    path("api/v1/public/leads/", PublicLeadView.as_view()),
    path("api/v1/reports/financial/", FinancialReportView.as_view()),
    path("api/v1/reports/financial/download/", FinancialDownloadView.as_view()),
    path("api/v1/health/", HealthView.as_view()),
    path("api/v1/operations/", OperationsView.as_view()),
    path("api/v1/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/v1/docs/", SpectacularSwaggerView.as_view(url_name="schema")),
    path("api/v1/", include(router.urls)),
    path("media/<path:path>", public_media),
]
# Specific nested collection routes precede generic numeric object routes automatically
# through constrained lookups below.
for _, view, _ in [(None, StaffViewSet, None), (None, ParentViewSet, None), (None, SubjectViewSet, None)]:
    view.lookup_value_regex = r"\d+"
