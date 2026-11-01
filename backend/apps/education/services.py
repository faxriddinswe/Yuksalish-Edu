from datetime import datetime, timedelta
from django.db import connection, transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from apps.audit.services import audit
from apps.notifications.services import notify_student
from .models import Enrollment, StudyGroup, Lesson


def lock_resources(teacher_id, room_id, previous=None):
    # All writers use identical sorted locks, including rescheduling.
    resource_ids = [10_000_000 + teacher_id, 20_000_000 + room_id]
    if previous:
        resource_ids += [10_000_000 + previous[0], 20_000_000 + previous[1]]
    for value in sorted(set(resource_ids)):
        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_advisory_xact_lock(%s)", [value])


@transaction.atomic
def save_lesson(actor, values, instance=None, reason=""):
    if instance:
        instance = Lesson.objects.select_for_update().get(pk=instance.pk)
    teacher = values.get("teacher", instance.teacher if instance else None)
    room = values.get("room", instance.room if instance else None)
    group = values.get("group", instance.group if instance else None)
    start = values.get("starts_at", instance.starts_at if instance else None)
    end = values.get("ends_at", instance.ends_at if instance else None)
    status = values.get("status", instance.status if instance else "SCHEDULED")
    if not all([teacher, room, group, start, end]) or start >= end:
        raise ValidationError("Dars vaqti va resurslarini to‘g‘ri kiriting.")
    if instance and instance.group_id != group.pk:
        raise ValidationError("Tarix saqlanishi uchun dars guruhini almashtirmang. Yangi dars yarating.")
    if not room.is_active or not teacher.is_active:
        raise ValidationError("Xona yoki ustoz nofaol.")
    lock_resources(
        teacher.pk, room.pk, previous=(instance.teacher_id, instance.room_id) if instance else None
    )
    conflicts = (
        Lesson.objects.exclude(status="CANCELLED")
        .filter(starts_at__lt=end, ends_at__gt=start)
        .filter(Q(room=room) | Q(teacher=teacher))
    )
    if instance:
        conflicts = conflicts.exclude(pk=instance.pk)
    if status != "CANCELLED" and conflicts.exists():
        raise ValidationError("Bu vaqtda xona yoki ustoz boshqa darsda band.")
    if instance:
        if not reason.strip():
            raise ValidationError("Dars o‘zgarishi sababi kerak.")
        before = {
            "starts_at": instance.starts_at.isoformat(),
            "ends_at": instance.ends_at.isoformat(),
            "status": instance.status,
            "room": instance.room_id,
            "teacher": instance.teacher_id,
        }
        for key, value in values.items():
            setattr(instance, key, value)
        instance.full_clean()
        instance.save()
        lesson = instance
        audit(
            actor,
            "lesson.changed",
            lesson,
            before=before,
            after={"starts_at": start.isoformat(), "status": status},
            reason=reason,
        )
        for student_id in group.enrollments.values_list("student_id", flat=True).distinct():
            notify_student(
                student_id,
                "SCHEDULE",
                "Dars jadvali o‘zgardi",
                f"{group.name}: {timezone.localtime(start):%d.%m.%Y %H:%M}. Sabab: {reason}",
                f"lesson:{lesson.pk}:{lesson.updated_at.isoformat()}",
                lesson=lesson,
            )
    else:
        lesson = Lesson(**values)
        lesson.full_clean()
        lesson.save()
        audit(actor, "lesson.created", lesson, after={"starts_at": start.isoformat()})
    return lesson


@transaction.atomic
def enroll(actor, student, group, start_date):
    from apps.students.models import Student

    Student.objects.select_for_update().get(pk=student.pk)
    group = StudyGroup.objects.select_for_update().get(pk=group.pk)
    if group.status != "ACTIVE" or student.status != "ACTIVE":
        raise ValidationError("Faqat faol o‘quvchi va guruhga a’zolik ochiladi.")
    active = Enrollment.objects.filter(group=group, status="ACTIVE")
    if active.count() >= min(group.capacity, group.room.capacity):
        raise ValidationError("Guruh sig‘imi to‘lgan.")
    if Enrollment.objects.filter(
        student=student, group__course__subject=group.course.subject, status="ACTIVE"
    ).exists():
        raise ValidationError("Bu fan bo‘yicha faol a’zolik bor. Guruh ko‘chirishdan foydalaning.")
    obj = Enrollment.objects.create(student=student, group=group, start_date=start_date)
    audit(
        actor,
        "enrollment.created",
        obj,
        after={"student": student.pk, "group": group.pk, "start_date": str(start_date)},
    )
    return obj


@transaction.atomic
def end_enrollment(actor, enrollment, end_date, reason):
    if not reason.strip() or end_date < enrollment.start_date or enrollment.status != "ACTIVE":
        raise ValidationError("Sana, faol a’zolik va sababni tekshiring.")
    enrollment = Enrollment.objects.select_for_update().get(pk=enrollment.pk)
    enrollment.end_date = end_date
    enrollment.status = "ENDED"
    enrollment.save()
    audit(actor, "enrollment.ended", enrollment, after={"end_date": str(end_date)}, reason=reason)
    return enrollment


@transaction.atomic
def transfer(actor, enrollment, new_group, on_date, reason):
    if new_group.course.subject_id != enrollment.group.course.subject_id:
        raise ValidationError("Ko‘chirish bir fan ichida bo‘lishi kerak.")
    if on_date <= enrollment.start_date:
        raise ValidationError("Ko‘chirish boshlanish sanasidan keyin bo‘lsin.")
    end_enrollment(actor, enrollment, on_date - timedelta(days=1), reason)
    obj = enroll(actor, enrollment.student, new_group, on_date)
    audit(actor, "enrollment.transferred", obj, after={"previous": enrollment.pk}, reason=reason)
    return obj


@transaction.atomic
def generate_lessons(actor, rule):
    day = rule.valid_from
    if (rule.valid_until - day).days > 180:
        raise ValidationError("Bir martada ko‘pi bilan 180 kunlik dars yarating.")
    created = 0
    while day <= rule.valid_until:
        if day.weekday() == rule.weekday:
            key = f"rule:{rule.pk}:{day}"
            lock_resources(rule.group.teacher_id, rule.group.room_id)
            if not Lesson.objects.filter(source_key=key).exists():
                start = timezone.make_aware(datetime.combine(day, rule.start_time))
                end = timezone.make_aware(datetime.combine(day, rule.end_time))
                save_lesson(
                    actor,
                    {
                        "group": rule.group,
                        "room": rule.group.room,
                        "teacher": rule.group.teacher,
                        "starts_at": start,
                        "ends_at": end,
                        "source_key": key,
                    },
                )
                created += 1
        day += timedelta(days=1)
    return created
