import pytest
from apps.accounts.models import User

pytestmark = pytest.mark.django_db


def test_anonymous_private_denied(client_for):
    for path in ["students/", "billing/invoices/", "reports/financial/", "audit/", "notifications/"]:
        assert client_for().get("/api/v1/" + path).status_code == 403


@pytest.mark.parametrize("role", ["STUDENT", "PARENT"])
def test_cannot_access_other_child(academy, users, client_for, role):
    client = client_for(users[role])
    assert client.get(f"/api/v1/students/{academy['student'].pk}/").status_code == 200
    assert client.get(f"/api/v1/students/{academy['stranger'].pk}/").status_code == 404
    assert client.get("/api/v1/students/").data["count"] == 1


def test_admin_cannot_record_payment(users, client_for):
    assert (
        client_for(users["ADMINISTRATOR"]).post("/api/v1/billing/payments/", {}, format="json").status_code
        == 403
    )


def test_accountant_cannot_escalate(users, client_for):
    client = client_for(users["ACCOUNTANT"])
    assert (
        client.patch(
            f"/api/v1/staff/{users['ACCOUNTANT'].pk}/", {"roles": ["OWNER_ADMIN"]}, format="json"
        ).status_code
        == 403
    )
    assert (
        client.post(
            "/api/v1/staff/",
            {"phone": "+998907654321", "full_name": "X", "roles": ["OWNER_ADMIN"]},
            format="json",
        ).status_code
        == 403
    )


def test_admin_parent_creation_cannot_escalate(users, client_for):
    response = client_for(users["ADMINISTRATOR"]).post(
        "/api/v1/parents/",
        {
            "phone": "+998907654321",
            "full_name": "Yangi ota-ona",
            "roles": ["OWNER_ADMIN"],
            "extra_permissions": ["billing.record_payment"],
        },
        format="json",
    )
    assert response.status_code == 403, response.data
    assert not User.objects.filter(phone="+998907654321").exists()


def test_admin_financial_list_requires_student(users, academy, client_for):
    client = client_for(users["ADMINISTRATOR"])
    assert client.get("/api/v1/billing/invoices/").status_code == 403
    assert client.get("/api/v1/billing/invoices/", {"student": academy["student"].pk}).status_code == 200
    assert client.get("/api/v1/reports/financial/").status_code == 403


def test_readonly_audit(users, client_for):
    client = client_for(users["OWNER_ADMIN"])
    assert client.post("/api/v1/audit/", {}, format="json").status_code == 405
    assert client_for(users["ADMINISTRATOR"]).get("/api/v1/audit/").status_code == 403


def test_nested_resource_routes(users, client_for):
    client = client_for(users["OWNER_ADMIN"])
    for path in ["parents/links/", "staff/teachers/", "subjects/prices/"]:
        assert client.get("/api/v1/" + path).status_code == 200


def test_parent_role_removal_revokes_child_finance(academy, users, client_for):
    from apps.billing.models import Invoice
    from datetime import date

    invoice = Invoice.objects.create(
        student=academy["student"],
        subject=academy["subject"],
        month=date(2026, 2, 1),
        amount=300000,
        due_date=date(2026, 2, 10),
        status="CONFIRMED",
    )
    user = users["PARENT"]
    user.roles = ["TEACHER"]
    user.save()
    response = client_for(user).get(f"/api/v1/billing/invoices/{invoice.pk}/")
    assert response.status_code == 403


def test_guardian_unlink_revokes_old_notifications(academy, users, client_for):
    from apps.notifications.services import notify_student
    from apps.students.models import ParentLink

    notify_student(academy["student"].pk, "REMINDER", "Hisob", "Shaxsiy xabar", "scope-test")
    client = client_for(users["PARENT"])
    assert client.get("/api/v1/notifications/").data["count"] == 1
    ParentLink.objects.filter(parent=users["PARENT"]).delete()
    assert client.get("/api/v1/notifications/").data["count"] == 0


def test_teacher_profile_rejects_non_teacher_account(users, client_for):
    response = client_for(users["OWNER_ADMIN"]).post(
        "/api/v1/staff/teachers/",
        {"user": users["STUDENT"].pk, "full_name": "Test", "slug": "invalid-teacher"},
        format="json",
    )
    assert response.status_code == 400
