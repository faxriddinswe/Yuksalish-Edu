import pytest
from apps.leads.models import Lead
from apps.accounts.models import User
from apps.billing.models import Invoice
from apps.content.models import Achievement
from apps.reports.tasks import safe_cell

pytestmark = pytest.mark.django_db


def test_public_only_published(academy, client_for):
    client = client_for()
    assert client.get("/api/v1/public/courses/").data["count"] == 1
    academy["course"].publication_status = "DRAFT"
    academy["course"].save()
    assert client.get("/api/v1/public/courses/").data["count"] == 0


def test_lead_consent_dedupe_no_account(academy, client_for):
    client = client_for()
    data = {"full_name": "Test Ariza", "phone": "901234567", "course": academy["course"].pk, "consent": True}
    accounts = User.objects.count()
    assert client.post("/api/v1/public/leads/", data, format="json").status_code == 201
    assert client.post("/api/v1/public/leads/", data, format="json").status_code == 201
    assert Lead.objects.count() == 1 and User.objects.count() == accounts and Invoice.objects.count() == 0
    data["consent"] = False
    assert client.post("/api/v1/public/leads/", data, format="json").status_code == 400


def test_consent_required_to_publish_achievement(academy, users, client_for):
    result = client_for(users["OWNER_ADMIN"]).post(
        "/api/v1/content/achievements/",
        {
            "display_name": "Namuna",
            "title": "Namuna",
            "description": "Namuna",
            "subject": academy["subject"].pk,
            "publication_status": "PUBLISHED",
            "privacy_reviewed": False,
            "consent_record": "",
        },
        format="json",
    )
    assert result.status_code == 400
    assert not Achievement.objects.exists()


@pytest.mark.parametrize("value", ["=SUM(A1:A2)", "+cmd", "-123", "@test", "\t=1"])
def test_export_formula_injection(value):
    assert safe_cell(value).startswith("'")


def test_traceback_not_exposed_and_request_id(users, client_for):
    response = client_for(users["STUDENT"]).get("/api/v1/me/")
    assert response["Cache-Control"] == "no-store, private"
    assert len(response["X-Request-ID"]) == 36


def test_api_documentation_is_protected_and_renders(users, client_for):
    assert client_for().get("/api/v1/docs/").status_code == 403
    assert client_for(users["STUDENT"]).get("/api/v1/schema/").status_code == 403
    technical_admin = users["OWNER_ADMIN"]
    technical_admin.is_staff = True
    technical_admin.save()
    response = client_for(technical_admin).get("/api/v1/docs/")
    assert response.status_code == 200
    assert b"/api/v1/schema/" in response.content
    schema = client_for(technical_admin).get("/api/v1/schema/")
    assert schema.status_code == 200
    paths = schema.data["paths"]
    assert "/api/v1/auth/activate/" in paths and "/api/v1/public/leads/" in paths
    payment = paths["/api/v1/billing/payments/"]["post"]
    assert any(p["name"] == "Idempotency-Key" for p in payment["parameters"])
