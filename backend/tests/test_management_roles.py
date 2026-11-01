import pytest

from apps.accounts.models import User
from apps.accounts.services import issue_invitation
from apps.audit.models import AuditEvent
from apps.content.models import FAQ

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize("role", ["OWNER_ADMIN", "ADMINISTRATOR"])
def test_office_can_create_assign_edit_and_delete_accounts(users, client_for, role):
    client = client_for(users[role])
    response = client.post(
        "/api/v1/staff/",
        {"phone": "+998937654321", "full_name": "Yangi xodim", "roles": ["TEACHER"]},
        format="json",
    )
    assert response.status_code == 201, response.data
    pk = response.data["id"]
    assert (
        client.patch(
            f"/api/v1/staff/{pk}/", {"roles": ["ADMINISTRATOR"], "full_name": "Yangilandi"}, format="json"
        ).status_code
        == 200
    )
    assert issue_invitation(users[role], User.objects.get(pk=pk), "ACTIVATE")
    # Invitation history protects the account: deactivate it instead.
    assert client.delete(f"/api/v1/staff/{pk}/").status_code == 400
    assert client.patch(f"/api/v1/staff/{pk}/", {"is_active": False}, format="json").status_code == 200
    unused = User.objects.create_user("+998937654322", full_name="Foydalanilmagan", roles=["TEACHER"])
    unused_pk = unused.pk
    assert client.delete(f"/api/v1/staff/{unused_pk}/").status_code == 204
    assert not User.objects.filter(pk=unused_pk).exists()
    assert AuditEvent.objects.filter(action="record.deleted", entity_id=str(unused_pk)).exists()


def test_admin_cannot_modify_owner_or_grant_owner_and_finance_exceptions(users, client_for):
    client = client_for(users["ADMINISTRATOR"])
    path = f"/api/v1/staff/{users['OWNER_ADMIN'].pk}/"
    assert client.patch(path, {"full_name": "Hujum"}, format="json").status_code == 403
    assert client.delete(path).status_code == 403
    for values in [{"roles": ["OWNER_ADMIN"]}, {"extra_permissions": ["billing.record_payment"]}]:
        assert client.patch(f"/api/v1/staff/{users['TEACHER'].pk}/", values, format="json").status_code == 403
    assert (
        client.patch(
            f"/api/v1/staff/{users['ADMINISTRATOR'].pk}/", {"roles": ["ACCOUNTANT"]}, format="json"
        ).status_code
        == 403
    )


@pytest.mark.parametrize("role", ["OWNER_ADMIN", "ADMINISTRATOR"])
def test_office_content_crud_and_guarded_delete(academy, users, client_for, role):
    client = client_for(users[role])
    obj = FAQ.objects.create(question="Sinov", answer="Test")
    assert (
        client.patch(f"/api/v1/content/faqs/{obj.pk}/", {"answer": "Tahrirlandi"}, format="json").status_code
        == 200
    )
    assert client.delete(f"/api/v1/content/faqs/{obj.pk}/").status_code == 204
    response = client.delete(f"/api/v1/subjects/{academy['subject'].pk}/")
    assert response.status_code == 400
    assert academy["subject"].__class__.objects.filter(pk=academy["subject"].pk).exists()


@pytest.mark.parametrize("role", ["ACCOUNTANT", "TEACHER", "STUDENT", "PARENT"])
def test_non_office_cannot_change_accounts_or_public_content(users, client_for, role):
    client = client_for(users[role])
    obj = FAQ.objects.create(question="Sinov", answer="Test")
    assert client.delete(f"/api/v1/content/faqs/{obj.pk}/").status_code == 403
    assert client.patch(f"/api/v1/content/faqs/{obj.pk}/", {"answer": "X"}, format="json").status_code == 403
    assert client.post("/api/v1/staff/", {}, format="json").status_code == 403


@pytest.mark.parametrize("role", ["OWNER_ADMIN", "ADMINISTRATOR"])
def test_cannot_delete_or_deactivate_own_account(users, client_for, role):
    client = client_for(users[role])
    path = f"/api/v1/staff/{users[role].pk}/"
    assert client.delete(path).status_code == 400
    assert client.patch(path, {"is_active": False}, format="json").status_code == 400
    if role == "OWNER_ADMIN":
        assert client.patch(path, {"roles": ["ADMINISTRATOR"]}, format="json").status_code == 400
        assert client.patch(path, {"roles": ["ACCOUNTANT"]}, format="json").status_code == 400
