from datetime import timedelta
import pytest
from django.utils import timezone
from django.contrib.auth.hashers import check_password
from rest_framework.exceptions import ValidationError, Throttled, PermissionDenied
from apps.accounts.models import normalize_phone, AccountInvitation, User
from apps.accounts.services import issue_invitation, redeem_invitation, rate_limit

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize("value", ["90 123 45 67", "+998 (90) 123-45-67", "998901234567"])
def test_phone_normalization(value):
    assert normalize_phone(value) == "+998901234567"


@pytest.mark.parametrize("value", ["", "+123456789", "998hello123456", "+9989012345678"])
def test_invalid_phone(value):
    from django.core.exceptions import ValidationError as DjangoValidationError

    with pytest.raises(DjangoValidationError):
        normalize_phone(value)


def test_login_logout_and_session(users, client_for):
    client = client_for(csrf=True)
    token = client.get("/api/v1/auth/session/").data["csrfToken"]
    payload = {"phone": users["STUDENT"].phone, "password": "Testing-password-42"}
    assert client.post("/api/v1/auth/session/", payload, format="json").status_code == 403
    response = client.post("/api/v1/auth/session/", payload, format="json", HTTP_X_CSRFTOKEN=token)
    assert response.status_code == 200
    assert client.get("/api/v1/me/").data["id"] == users["STUDENT"].pk
    token = client.cookies["csrftoken"].value
    assert client.delete("/api/v1/auth/session/", HTTP_X_CSRFTOKEN=token).status_code == 200
    assert client.get("/api/v1/me/").status_code == 403


def test_login_generic_error(users, client_for):
    client = client_for()
    a = client.post(
        "/api/v1/auth/session/", {"phone": users["STUDENT"].phone, "password": "bad"}, format="json"
    )
    b = client.post("/api/v1/auth/session/", {"phone": "+998909999999", "password": "bad"}, format="json")
    assert a.data == b.data


def test_invitation_one_time_and_hashed(users):
    code = issue_invitation(users["ADMINISTRATOR"], users["STUDENT"])
    invite = AccountInvitation.objects.get(user=users["STUDENT"])
    assert invite.code_hash != code
    assert check_password(code, invite.code_hash)
    user = redeem_invitation(users["STUDENT"].phone, code, "New-secure-password-52", "ACTIVATE")
    assert user.check_password("New-secure-password-52")
    with pytest.raises(ValidationError):
        redeem_invitation(user.phone, code, "Different-secure-52", "ACTIVATE")


def test_expired_invitation(users):
    code = issue_invitation(users["OWNER_ADMIN"], users["STUDENT"])
    AccountInvitation.objects.filter(user=users["STUDENT"]).update(
        expires_at=timezone.now() - timedelta(seconds=1)
    )
    with pytest.raises(ValidationError):
        redeem_invitation(users["STUDENT"].phone, code, "New-secure-password-52", "ACTIVATE")


def test_reissue_invalidates_previous_and_attempt_limit(users):
    old = issue_invitation(users["OWNER_ADMIN"], users["STUDENT"])
    new = issue_invitation(users["OWNER_ADMIN"], users["STUDENT"])
    for _ in range(5):
        with pytest.raises(ValidationError):
            redeem_invitation(users["STUDENT"].phone, old, "New-secure-password-52", "ACTIVATE")
    assert AccountInvitation.objects.get(user=users["STUDENT"]).attempts == 5
    with pytest.raises(ValidationError):
        redeem_invitation(users["STUDENT"].phone, new, "New-secure-password-52", "ACTIVATE")


def test_admin_cannot_reset_owner(users):
    with pytest.raises(PermissionDenied):
        issue_invitation(users["ADMINISTRATOR"], users["OWNER_ADMIN"], "RESET")


def test_password_reset_and_deactivation(users, client_for):
    user = users["STUDENT"]
    code = issue_invitation(users["OWNER_ADMIN"], user, "RESET")
    redeem_invitation(user.phone, code, "New-secure-password-52", "RESET")
    client = client_for()
    assert client.login(phone=user.phone, password="New-secure-password-52")
    user.is_active = False
    user.save()
    assert client.get("/api/v1/me/").status_code == 403


def test_rate_limit_persists_rejections():
    rate_limit("sample", 2)
    rate_limit("sample", 2)
    with pytest.raises(Throttled):
        rate_limit("sample", 2)


def test_superuser_is_not_owner(client_for):
    user = User.objects.create_superuser("+998909123456", "Test-password-42", full_name="Texnik")
    assert client_for(user).get("/api/v1/reports/financial/").status_code == 403
