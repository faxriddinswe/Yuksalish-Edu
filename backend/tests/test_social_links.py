import pytest
from apps.content.models import SiteSettings
from apps.audit.models import AuditEvent

pytestmark = pytest.mark.django_db


def test_social_settings_edit_publish_and_clear(users, client_for):
    settings = SiteSettings.objects.create()
    url = f"/api/v1/content/settings/{settings.pk}/"
    links = {
        "telegram_url": "https://t.me/yuksalish_e2e_fixture",
        "instagram_url": "https://www.instagram.com/yuksalish_e2e_fixture/",
        "linkedin_url": "https://www.linkedin.com/company/yuksalish-e2e-fixture/",
    }
    for role in ["ACCOUNTANT", "TEACHER", "STUDENT", "PARENT"]:
        assert client_for(users[role]).patch(url, links, format="json").status_code == 403
    assert client_for(users["ADMINISTRATOR"]).patch(url, links, format="json").status_code == 200
    response = client_for(users["OWNER_ADMIN"]).patch(url, links, format="json")
    assert response.status_code == 200, response.data
    for field, value in links.items():
        assert client_for().get("/api/v1/public/settings/").data[field] == value
    assert AuditEvent.objects.filter(entity_id=str(settings.pk)).exists()
    response = client_for(users["OWNER_ADMIN"]).patch(url, {"telegram_url": ""}, format="json")
    assert response.status_code == 200
    data = client_for().get("/api/v1/public/settings/").data
    assert data["telegram_url"] == "" and data["instagram_url"] == links["instagram_url"]


@pytest.mark.parametrize(
    "field,value",
    [
        ("telegram_url", "javascript:alert(1)"),
        ("telegram_url", "http://t.me/account"),
        ("telegram_url", "https://t.me.attacker.example/account"),
        ("telegram_url", "https://t.me@attacker.example/account"),
        ("instagram_url", "https://example.com/account"),
        ("instagram_url", "https://instagram.com.attacker.example/account"),
        ("linkedin_url", "https://www.linkedin.com@attacker.example/account"),
        ("linkedin_url", "ftp://www.linkedin.com/company/test"),
    ],
)
def test_social_urls_reject_wrong_domains_and_schemes(users, client_for, field, value):
    settings = SiteSettings.objects.create()
    response = client_for(users["OWNER_ADMIN"]).patch(
        f"/api/v1/content/settings/{settings.pk}/",
        {field: value},
        format="json",
    )
    assert response.status_code == 400
    settings.refresh_from_db()
    assert getattr(settings, field) == ""


def test_unconfigured_social_links_are_empty(client_for):
    data = client_for().get("/api/v1/public/settings/").data
    assert {data[key] for key in ["telegram_url", "instagram_url", "linkedin_url"]} == {""}
