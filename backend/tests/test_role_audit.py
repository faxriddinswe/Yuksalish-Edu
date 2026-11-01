from datetime import date
from io import StringIO
from uuid import uuid4

import pytest
from django.contrib.auth import SESSION_KEY
from django.contrib.sessions.backends.db import SessionStore
from django.contrib.sessions.models import Session
from django.core.management import call_command, CommandError
from django.test import override_settings

from apps.accounts.models import User
from apps.audit.models import AuditEvent
from apps.billing.models import Payment
from apps.education.models import Enrollment
from apps.students.models import Student
from common.permissions import allowed

pytestmark = pytest.mark.django_db
ROLES = ["OWNER_ADMIN", "ADMINISTRATOR", "ACCOUNTANT", "TEACHER", "STUDENT", "PARENT"]


@pytest.mark.parametrize("role", ROLES)
def test_six_role_read_matrix(academy, users, client_for, role):
    # Reference data needed by finance filters remains readable to accountants.
    office = {"OWNER_ADMIN", "ADMINISTRATOR"}
    finance = {"OWNER_ADMIN", "ACCOUNTANT"}
    educational = set(ROLES) - {"ACCOUNTANT"}
    all_roles = set(ROLES)
    paths = {
        "me/": all_roles,
        "overview/": office,
        "students/": all_roles,
        "parents/": office,
        "parents/links/": office | {"PARENT"},
        "staff/": office,
        "staff/teachers/": office | {"ACCOUNTANT", "TEACHER"},
        "staff/teacher-finance/": finance,
        "subjects/": office | {"ACCOUNTANT"},
        "subjects/prices/": office | {"ACCOUNTANT"},
        "courses/": office,
        "rooms/": office | {"TEACHER"},
        "groups/": all_roles,
        "enrollments/": educational,
        "lessons/": educational,
        "schedule/": office | {"TEACHER"},
        "attendance/": educational,
        "billing/invoices/": finance | {"STUDENT", "PARENT"},
        "billing/payments/": finance | {"STUDENT", "PARENT"},
        "billing/adjustments/": finance | {"STUDENT", "PARENT"},
        "billing/teacher-payments/": finance,
        "leads/": office,
        "notifications/": all_roles,
        "notifications/broadcasts/": office,
        "content/settings/": office,
        "content/faqs/": office,
        "content/achievements/": office | {"TEACHER"},
        "reports/financial/": finance,
        "reports/exports/": finance,
        "audit/": {"OWNER_ADMIN"},
    }
    client = client_for(users[role])
    for path, roles in paths.items():
        response = client.get("/api/v1/" + path)
        assert response.status_code == (200 if role in roles else 403), (role, path, response.data)
    for path in ["billing/invoices/", "billing/payments/"]:
        response = client.get("/api/v1/" + path, {"student": academy["student"].pk})
        assert response.status_code == (403 if role == "TEACHER" else 200), (path, response.data)


@pytest.mark.parametrize("role", ["STUDENT", "PARENT", "TEACHER", "ACCOUNTANT"])
def test_non_office_cannot_write_management(academy, users, client_for, role):
    client = client_for(users[role])
    for path in [
        "students/",
        "staff/",
        "parents/",
        "groups/",
        "enrollments/",
        "courses/",
        "leads/",
        "content/settings/",
    ]:
        assert client.post("/api/v1/" + path, {}, format="json").status_code == 403, (role, path)
    if role != "TEACHER":
        assert client.post("/api/v1/attendance/", {}, format="json").status_code == 403


@pytest.mark.parametrize("role", ["STUDENT", "PARENT", "TEACHER"])
def test_personal_scopes_never_contain_another_class(academy, users, client_for, role):
    Enrollment.objects.create(student=academy["student"], group=academy["group"], start_date=date(2026, 1, 1))
    client = client_for(users[role])
    data = client.get("/api/v1/students/").data
    assert [row["id"] for row in data["results"]] == [academy["student"].pk]
    assert client.get(f"/api/v1/students/{academy['stranger'].pk}/").status_code == 404
    assert client.get("/api/v1/groups/").data["count"] == 1
    assert client.get("/api/v1/enrollments/").data["count"] == 1
    if role in ["STUDENT", "PARENT"]:
        assert client.get(f"/api/v1/groups/{academy['group'].pk}/members/").status_code == 403


def test_center_overviews_are_role_specific(academy, users, client_for):
    owner = client_for(users["OWNER_ADMIN"]).get("/api/v1/overview/").data
    admin = client_for(users["ADMINISTRATOR"]).get("/api/v1/overview/").data
    assert owner["students_total"] == admin["students_total"] == 2
    assert "financial_summary" in owner
    assert set(owner["financial_summary"]) == {"billed", "cash_received", "remaining"}
    assert "financial_summary" not in admin


@pytest.mark.parametrize("role", ["STUDENT", "PARENT"])
def test_personal_payment_does_not_expose_finance_staff(academy, users, client_for, role):
    payment = Payment.objects.create(
        student=academy["student"],
        amount=100,
        paid_on=date.today(),
        entered_by=users["ACCOUNTANT"],
        idempotency_key=uuid4(),
        request_fingerprint="test",
    )
    personal = client_for(users[role]).get(f"/api/v1/billing/payments/{payment.pk}/")
    assert personal.status_code == 200
    assert "entered_by" not in personal.data
    assert (
        client_for(users["ACCOUNTANT"]).get(f"/api/v1/billing/payments/{payment.pk}/").data["entered_by"]
        == users["ACCOUNTANT"].pk
    )


def test_admin_cannot_grant_any_extra_permission_including_to_self(users, client_for):
    client = client_for(users["ADMINISTRATOR"])
    for target in [users["ADMINISTRATOR"], users["TEACHER"]]:
        response = client.patch(
            f"/api/v1/staff/{target.pk}/",
            {"extra_permissions": ["attendance.correct_attendance"]},
            format="json",
        )
        assert response.status_code == 403
        target.refresh_from_db()
        assert target.extra_permissions == []


def test_deactivated_account_cannot_use_exception_permission(users):
    user = users["STUDENT"]
    user.extra_permissions = ["billing.record_payment"]
    assert allowed(user, "billing.record_payment")
    user.is_active = False
    assert not allowed(user, "billing.record_payment")


def load_user(index):
    user = User.objects.create_user(
        phone=f"+99890500{index:04d}",
        full_name=f"Demo Yuklama xodimi {index + 1:03d}",
        roles=["ADMINISTRATOR", "ACCOUNTANT"],
    )
    user.set_unusable_password()
    user.save()
    return user


def session_for(user):
    session = SessionStore()
    session[SESSION_KEY] = str(user.pk)
    session.save()
    return session.session_key


def test_retire_load_accounts_is_precise_dry_run_and_idempotent(academy, users, client_for):
    candidate = load_user(0)
    real_password = load_user(1)
    real_password.set_password("Testing-password-42")
    real_password.save()
    linked = load_user(2)
    Student.objects.create(user=linked, full_name="Haqiqiy o‘quvchi", registered_on=date.today())
    renamed = load_user(3)
    renamed.full_name = "Haqiqiy xodim"
    renamed.save()
    retired_session, real_session = session_for(candidate), session_for(users["OWNER_ADMIN"])
    count = Student.objects.count()
    out = StringIO()
    call_command("retire_load_accounts", stdout=out)
    candidate.refresh_from_db()
    assert candidate.is_active and Session.objects.filter(pk=retired_session).exists()
    call_command("retire_load_accounts", apply=True, stdout=out)
    candidate.refresh_from_db()
    assert not candidate.is_active and candidate.is_test_account and not candidate.roles
    assert not Session.objects.filter(pk=retired_session).exists()
    assert Session.objects.filter(pk=real_session).exists()
    assert Student.objects.count() == count
    assert User.objects.count() == 10
    for user in [real_password, linked, renamed, users["OWNER_ADMIN"]]:
        user.refresh_from_db()
        assert user.is_active and not user.is_test_account
    call_command("retire_load_accounts", apply=True, stdout=out)
    assert AuditEvent.objects.filter(action="account.load_retired").count() == 1
    assert candidate.pk not in [
        row["id"] for row in client_for(users["OWNER_ADMIN"]).get("/api/v1/staff/").data["results"]
    ]


@override_settings(DEBUG=True)
def test_prepare_load_refuses_working_database_before_creating_anything(users):
    before = User.objects.count(), Session.objects.count()
    with pytest.raises(CommandError, match="load_"):
        call_command("prepare_load", stdout=StringIO())
    assert before == (User.objects.count(), Session.objects.count())
