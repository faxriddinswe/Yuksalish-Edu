from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError
from common.permissions import has_role, allowed, OWNER, TEACHER
from apps.education.models import Enrollment, Lesson
from apps.audit.services import audit
from .models import Attendance


def check_lesson_access(actor, lesson):
    if not (
        has_role(actor, OWNER)
        or (has_role(actor, TEACHER) and lesson.teacher.user_id == actor.pk)
        or allowed(actor, "attendance.correct_attendance")
    ):
        raise PermissionDenied()
    if lesson.status == "CANCELLED":
        raise ValidationError("Bekor qilingan darsga davomat qo‘yilmaydi.")


@transaction.atomic
def mark_attendance(actor, lesson, student, status, note="", reason=""):
    lesson = Lesson.objects.select_for_update().get(pk=lesson.pk)
    check_lesson_access(actor, lesson)
    if status not in dict(Attendance._meta.get_field("status").choices):
        raise ValidationError("Davomat holati noto‘g‘ri.")
    day = timezone.localtime(lesson.starts_at).date()
    enrollment = (
        Enrollment.objects.filter(student=student, group=lesson.group, start_date__lte=day)
        .filter(Q(end_date__isnull=True) | Q(end_date__gte=day))
        .first()
    )
    if not enrollment:
        raise ValidationError("O‘quvchi shu dars sanasida guruh a’zosi emas.")
    old = Attendance.objects.filter(lesson=lesson, student=student).first()
    if old and old.status == status and old.note == note:
        return old
    if old and not reason.strip():
        raise ValidationError("Davomat tuzatish sababini kiriting.")
    obj, _ = Attendance.objects.update_or_create(
        lesson=lesson,
        student=student,
        defaults={"enrollment": enrollment, "status": status, "note": note, "marked_by": actor},
    )
    audit(
        actor,
        "attendance.corrected" if old else "attendance.marked",
        obj,
        before={"status": old.status} if old else {},
        after={"status": status},
        reason=reason,
    )
    return obj


@transaction.atomic
def confirm_unmarked_present(actor, lesson):
    lesson = Lesson.objects.select_for_update().get(pk=lesson.pk)
    check_lesson_access(actor, lesson)
    day = timezone.localtime(lesson.starts_at).date()
    members = (
        Enrollment.objects.filter(group=lesson.group, start_date__lte=day)
        .filter(Q(end_date__isnull=True) | Q(end_date__gte=day))
        .exclude(student_id__in=Attendance.objects.filter(lesson=lesson).values("student_id"))
        .select_related("student")
        .order_by("student_id")
    )
    created = 0
    for member in members:
        mark_attendance(actor, lesson, member.student, "PRESENT")
        created += 1
    return created
