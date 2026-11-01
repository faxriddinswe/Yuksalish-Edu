from datetime import date, timedelta, time
import pytest
from django.utils import timezone
from rest_framework.exceptions import ValidationError, PermissionDenied
from apps.education.models import Subject, Course, StudyGroup, Enrollment, ScheduleRule, Lesson
from apps.education.services import enroll, transfer, save_lesson, generate_lessons
from apps.attendance.models import Attendance
from apps.attendance.services import mark_attendance
from apps.accounts.models import User

pytestmark = pytest.mark.django_db


def test_multiple_subjects_and_transfer(academy, users):
    owner = users["OWNER_ADMIN"]
    a = academy
    old = enroll(owner, a["student"], a["group"], date(2026, 1, 1))
    subject = Subject.objects.create(name="Kimyo", slug="chemistry")
    course = Course.objects.create(subject=subject, name="Kimyo", slug="chemistry", summary="Kimyo")
    second = StudyGroup.objects.create(
        name="Kimyo A",
        course=course,
        room=a["room"],
        teacher=a["teacher"],
        capacity=20,
        start_date=date(2026, 1, 1),
    )
    enroll(owner, a["student"], second, date(2026, 1, 1))
    new = StudyGroup.objects.create(
        name="Math B",
        course=a["course"],
        room=a["room"],
        teacher=a["teacher"],
        capacity=20,
        start_date=date(2026, 1, 1),
    )
    transfer(owner, old, new, date(2026, 2, 1), "Vaqtni o‘zgartirish")
    old.refresh_from_db()
    assert old.status == "ENDED" and old.end_date == date(2026, 1, 31)
    assert Enrollment.objects.filter(student=a["student"]).count() == 3
    assert Enrollment.objects.filter(student=a["student"], status="ACTIVE").count() == 2


def lesson(a, owner, offset=0, **kwargs):
    start = timezone.now() + timedelta(days=offset)
    return save_lesson(
        owner,
        {
            "group": a["group"],
            "room": a["room"],
            "teacher": a["teacher"],
            "starts_at": start,
            "ends_at": start + timedelta(hours=1),
            **kwargs,
        },
    )


def test_room_and_teacher_conflict(academy, users):
    first = lesson(academy, users["OWNER_ADMIN"])
    with pytest.raises(ValidationError):
        save_lesson(
            users["OWNER_ADMIN"],
            {
                "group": academy["group"],
                "room": academy["room"],
                "teacher": academy["teacher"],
                "starts_at": first.starts_at + timedelta(minutes=30),
                "ends_at": first.ends_at + timedelta(hours=1),
            },
        )
    assert Lesson.objects.count() == 1


def test_cancelled_lesson_does_not_conflict(academy, users):
    first = lesson(academy, users["OWNER_ADMIN"], status="CANCELLED")
    save_lesson(
        users["OWNER_ADMIN"],
        {
            "group": academy["group"],
            "room": academy["room"],
            "teacher": academy["teacher"],
            "starts_at": first.starts_at,
            "ends_at": first.ends_at,
        },
    )
    assert Lesson.objects.count() == 2


def test_generation_idempotent(academy, users):
    rule = ScheduleRule.objects.create(
        group=academy["group"],
        weekday=0,
        start_time=time(9),
        end_time=time(10),
        valid_from=date(2026, 1, 1),
        valid_until=date(2026, 1, 31),
    )
    assert generate_lessons(users["OWNER_ADMIN"], rule) == 4
    assert generate_lessons(users["OWNER_ADMIN"], rule) == 0


def test_attendance_and_correction(academy, users):
    enroll(users["OWNER_ADMIN"], academy["student"], academy["group"], date(2026, 1, 1))
    obj = lesson(academy, users["OWNER_ADMIN"])
    assert not Attendance.objects.exists()
    mark_attendance(users["TEACHER"], obj, academy["student"], "PRESENT")
    with pytest.raises(ValidationError):
        mark_attendance(users["TEACHER"], obj, academy["student"], "LATE")
    mark_attendance(users["TEACHER"], obj, academy["student"], "LATE", reason="Vaqt tuzatildi")
    assert Attendance.objects.count() == 1
    assert Attendance.objects.get().status == "LATE"


def test_teacher_cannot_mark_other_group(academy, users):
    other = User.objects.create_user(
        "+998909999998", "Test-password-42", full_name="Begona ustoz", roles=["TEACHER"]
    )
    obj = lesson(academy, users["OWNER_ADMIN"])
    with pytest.raises(PermissionDenied):
        mark_attendance(other, obj, academy["student"], "PRESENT")


def test_cancelled_attendance_rejected(academy, users):
    obj = lesson(academy, users["OWNER_ADMIN"], status="CANCELLED")
    with pytest.raises(ValidationError):
        mark_attendance(users["TEACHER"], obj, academy["student"], "PRESENT")


def test_capacity(academy, users):
    academy["group"].capacity = 1
    academy["group"].save()
    enroll(users["OWNER_ADMIN"], academy["student"], academy["group"], date(2026, 1, 1))
    with pytest.raises(ValidationError):
        enroll(users["OWNER_ADMIN"], academy["stranger"], academy["group"], date(2026, 1, 1))


def test_roster_scoped_and_keeps_unmarked_distinct(academy, users, client_for):
    enroll(users["OWNER_ADMIN"], academy["student"], academy["group"], date(2026, 1, 1))
    obj = lesson(academy, users["OWNER_ADMIN"])
    response = client_for(users["TEACHER"]).get(f"/api/v1/lessons/{obj.pk}/roster/")
    assert response.status_code == 200
    assert response.data["results"][0]["attendance_status"] is None
    assert client_for(users["PARENT"]).get(f"/api/v1/lessons/{obj.pk}/roster/").status_code == 403


def test_substitute_teacher_can_access_assigned_lesson_roster(academy, users, client_for):
    from apps.staff.models import TeacherProfile

    user = User.objects.create_user("+998909999997", roles=["TEACHER"], full_name="O‘rinbosar ustoz")
    teacher = TeacherProfile.objects.create(user=user, full_name=user.full_name, slug="substitute")
    enroll(users["OWNER_ADMIN"], academy["student"], academy["group"], date(2026, 1, 1))
    assigned = lesson(academy, users["OWNER_ADMIN"], teacher=teacher)
    response = client_for(user).get(f"/api/v1/lessons/{assigned.pk}/roster/")
    assert response.status_code == 200
    assert response.data["results"][0]["student"] == academy["student"].pk


def test_lesson_group_change_cannot_rewrite_history(academy, users):
    obj = lesson(academy, users["OWNER_ADMIN"])
    other = StudyGroup.objects.create(
        name="Boshqa guruh",
        course=academy["course"],
        teacher=academy["teacher"],
        room=academy["room"],
        capacity=20,
        start_date=date(2026, 1, 1),
    )
    with pytest.raises(ValidationError):
        save_lesson(users["OWNER_ADMIN"], {"group": other}, instance=obj, reason="O‘zgartirish")
    obj.refresh_from_db()
    assert obj.group_id == academy["group"].pk


@pytest.mark.django_db(transaction=True)
def test_parallel_lesson_conflict(academy, users):
    from threading import Barrier
    from concurrent.futures import ThreadPoolExecutor
    from django.db import close_old_connections, connections

    barrier = Barrier(2)
    starts = timezone.now() + timedelta(days=2)

    def create_one(_):
        close_old_connections()
        try:
            barrier.wait(timeout=10)
            save_lesson(
                users["OWNER_ADMIN"],
                {
                    "group": academy["group"],
                    "room": academy["room"],
                    "teacher": academy["teacher"],
                    "starts_at": starts,
                    "ends_at": starts + timedelta(hours=1),
                },
            )
            return "saved"
        except ValidationError:
            return "conflict"
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as pool:
        result = list(pool.map(create_one, range(2)))
    assert sorted(result) == ["conflict", "saved"]
    assert Lesson.objects.count() == 1
