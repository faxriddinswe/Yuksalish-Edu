from datetime import date, datetime, timedelta, timezone as dt_timezone
from unittest.mock import patch

import pytest
from django.utils import timezone
from apps.accounts.models import User
from apps.attendance.models import Attendance
from apps.audit.models import AuditEvent
from apps.education.models import Enrollment
from apps.education.services import enroll
from apps.staff.models import TeacherProfile
from apps.students.models import ParentLink
from tests.test_education import lesson

pytestmark = pytest.mark.django_db


def setup_lesson(academy, users):
    enroll(users["OWNER_ADMIN"], academy["student"], academy["group"], date(2026, 1, 1))
    return lesson(academy, users["OWNER_ADMIN"])


def test_attendance_api_correction_is_upsert(academy, users, client_for):
    obj = setup_lesson(academy, users)
    client = client_for(users["TEACHER"])
    payload = {"lesson": obj.pk, "student": academy["student"].pk, "status": "PRESENT"}
    first = client.post("/api/v1/attendance/", payload, format="json")
    assert first.status_code == 201, first.data
    denied = client.post("/api/v1/attendance/", {**payload, "status": "ABSENT"}, format="json")
    assert denied.status_code == 400
    assert "unique" not in str(denied.data).lower()
    updated = client.post(
        "/api/v1/attendance/", {**payload, "status": "ABSENT", "reason": "O‘quvchi kelmadi"}, format="json"
    )
    assert updated.status_code == 201, updated.data
    assert updated.data["id"] == first.data["id"]
    assert Attendance.objects.count() == 1
    assert Attendance.objects.get().status == "ABSENT"
    assert AuditEvent.objects.filter(action="attendance.corrected").count() == 1
    for role in ["STUDENT", "PARENT"]:
        result = client_for(users[role]).get("/api/v1/attendance/")
        assert result.data["count"] == 1
        assert result.data["results"][0]["status"] == "ABSENT"
        assert result.data["results"][0]["course_name"] == "Matematika"
    repeat = client.post("/api/v1/attendance/", {**payload, "status": "ABSENT"}, format="json")
    assert repeat.status_code == 201
    assert AuditEvent.objects.filter(action="attendance.corrected").count() == 1


def test_default_present_requires_save_and_keeps_previous_marks(academy, users, client_for):
    obj = setup_lesson(academy, users)
    enroll(users["OWNER_ADMIN"], academy["stranger"], academy["group"], date(2026, 1, 1))
    client = client_for(users["TEACHER"])
    roster = client.get(f"/api/v1/lessons/{obj.pk}/roster/")
    assert all(member["attendance_status"] is None for member in roster.data["results"])
    assert not Attendance.objects.exists()
    client.post(
        "/api/v1/attendance/",
        {"lesson": obj.pk, "student": academy["student"].pk, "status": "ABSENT"},
        format="json",
    )
    confirmed = client.post("/api/v1/attendance/confirm-present/", {"lesson": obj.pk}, format="json")
    assert confirmed.status_code == 200, confirmed.data
    assert confirmed.data["created"] == 1
    assert Attendance.objects.get(student=academy["student"]).status == "ABSENT"
    assert Attendance.objects.get(student=academy["stranger"]).status == "PRESENT"
    repeated = client.post("/api/v1/attendance/confirm-present/", {"lesson": obj.pk}, format="json")
    assert repeated.data["created"] == 0
    assert Attendance.objects.count() == 2


@pytest.mark.parametrize("role", ["STUDENT", "PARENT", "ACCOUNTANT", "ADMINISTRATOR"])
def test_default_present_rejects_unauthorized(academy, users, client_for, role):
    obj = setup_lesson(academy, users)
    assert (
        client_for(users[role])
        .post("/api/v1/attendance/confirm-present/", {"lesson": obj.pk}, format="json")
        .status_code
        == 403
    )
    assert not Attendance.objects.exists()


def test_default_present_rejects_foreign_and_cancelled(academy, users, client_for):
    obj = setup_lesson(academy, users)
    other = User.objects.create_user("+998909991122", roles=["TEACHER"])
    assert (
        client_for(other)
        .post("/api/v1/attendance/confirm-present/", {"lesson": obj.pk}, format="json")
        .status_code
        == 403
    )
    obj.status = "CANCELLED"
    obj.save()
    assert (
        client_for(users["TEACHER"])
        .post("/api/v1/attendance/confirm-present/", {"lesson": obj.pk}, format="json")
        .status_code
        == 400
    )
    assert not Attendance.objects.exists()


def test_default_present_rolls_back(academy, users, client_for):
    obj = setup_lesson(academy, users)
    enroll(users["OWNER_ADMIN"], academy["stranger"], academy["group"], date(2026, 1, 1))
    from apps.attendance.services import mark_attendance

    calls = 0

    def fail_second(*args, **kwargs):
        nonlocal calls
        calls += 1
        if calls == 2:
            raise RuntimeError("Simulated failure")
        return mark_attendance(*args, **kwargs)

    with patch("apps.attendance.services.mark_attendance", side_effect=fail_second):
        response = client_for(users["TEACHER"]).post(
            "/api/v1/attendance/confirm-present/", {"lesson": obj.pk}, format="json"
        )
    assert response.status_code == 500
    assert not Attendance.objects.exists()
    assert not AuditEvent.objects.filter(action="attendance.marked").exists()


def test_teacher_group_members_contacts_scoped(academy, users, client_for, django_assert_num_queries):
    setup_lesson(academy, users)
    academy["student"].phone = "+998901234567"
    academy["student"].internal_notes = "Private office note"
    academy["student"].save()
    teacher = client_for(users["TEACHER"])
    groups = teacher.get("/api/v1/groups/")
    assert groups.data["results"][0]["student_count"] == 1
    # Authentication is already forced. Bound query count catches per-student parent lookups.
    with django_assert_num_queries(4):
        response = teacher.get(f"/api/v1/groups/{academy['group'].pk}/members/")
    assert response.status_code == 200
    member = response.data["results"][0]
    assert member["student_phone"] == "+998901234567"
    assert member["parents"][0]["phone"] == users["PARENT"].phone
    assert "internal_notes" not in str(response.data)
    assert "Private office note" not in str(response.data)
    search = teacher.get(f"/api/v1/groups/{academy['group'].pk}/members/", {"search": users["PARENT"].phone})
    assert search.data["count"] == 1
    ParentLink.objects.all().delete()
    assert teacher.get(f"/api/v1/groups/{academy['group'].pk}/members/").data["results"][0]["parents"] == []
    for role in ["STUDENT", "PARENT", "ACCOUNTANT"]:
        assert (
            client_for(users[role]).get(f"/api/v1/groups/{academy['group'].pk}/members/").status_code == 403
        )
    other = User.objects.create_user("+998909991123", roles=["TEACHER"])
    assert client_for(other).get(f"/api/v1/groups/{academy['group'].pk}/members/").status_code == 404


def test_teacher_week_only_assigned_lessons(academy, users, client_for):
    own = setup_lesson(academy, users)
    other_user = User.objects.create_user("+998909991124", roles=["TEACHER"])
    other = TeacherProfile.objects.create(user=other_user, full_name="Boshqa ustoz", slug="other-teacher")
    substitute = lesson(academy, users["OWNER_ADMIN"], offset=1, teacher=other)
    response = client_for(users["TEACHER"]).get("/api/v1/lessons/")
    assert [row["id"] for row in response.data["results"]] == [own.pk]
    assert client_for(other_user).get("/api/v1/lessons/").data["results"][0]["id"] == substitute.pk
    # 20:00 UTC is already the next date in Tashkent.
    own.starts_at = datetime(2026, 10, 29, 20, 0, tzinfo=dt_timezone.utc)
    own.ends_at = own.starts_at + timedelta(hours=1)
    own.save()
    response = client_for(users["TEACHER"]).get(
        "/api/v1/lessons/", {"from": "2026-10-30", "to": "2026-11-05"}
    )
    assert [row["id"] for row in response.data["results"]] == [own.pk]
    assert client_for(users["TEACHER"]).get("/api/v1/lessons/", {"to": "2026-10-29"}).data["count"] == 0


def test_group_count_excludes_future_and_ended_memberships(academy, users, client_for):
    setup_lesson(academy, users)
    Enrollment.objects.create(
        student=academy["stranger"],
        group=academy["group"],
        start_date=timezone.localdate() + timedelta(days=1),
    )
    response = client_for(users["TEACHER"]).get("/api/v1/groups/")
    assert response.data["results"][0]["student_count"] == 1
    response = client_for(users["TEACHER"]).get(f"/api/v1/groups/{academy['group'].pk}/members/")
    assert response.data["count"] == 1


@pytest.mark.django_db(transaction=True)
def test_parallel_default_present_is_idempotent(academy, users):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    from django.db import close_old_connections, connections
    from apps.attendance.services import confirm_unmarked_present

    obj = setup_lesson(academy, users)
    barrier = Barrier(2)

    def confirm(_):
        close_old_connections()
        try:
            barrier.wait(timeout=10)
            return confirm_unmarked_present(users["TEACHER"], obj)
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(confirm, range(2))) == [0, 1]
    assert Attendance.objects.count() == 1
    assert AuditEvent.objects.filter(action="attendance.marked").count() == 1
