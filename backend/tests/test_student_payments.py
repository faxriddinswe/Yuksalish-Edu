from datetime import date
from uuid import uuid4

import pytest
from django.utils import timezone

from apps.billing.models import Invoice
from apps.billing.services import adjust_invoice, record_payment, void_payment
from apps.education.models import Course, Enrollment, Subject, StudyGroup

pytestmark = pytest.mark.django_db


@pytest.fixture
def debt(academy):
    return Invoice.objects.create(
        student=academy["student"],
        subject=academy["subject"],
        month=date(2026, 2, 1),
        amount=300000,
        due_date=date(2026, 2, 10),
        status="CONFIRMED",
    )


def payment(users, academy, allocations, amount):
    return record_payment(
        users["OWNER_ADMIN"],
        academy["student"],
        amount,
        date(2026, 2, 9),
        allocations,
        uuid4(),
    )[0]


def test_summary_is_scoped_and_includes_unpaid_history(academy, users, client_for, debt):
    Invoice.objects.create(
        student=academy["stranger"],
        subject=academy["subject"],
        month=debt.month,
        amount=900000,
        due_date=debt.due_date,
        status="CONFIRMED",
    )
    for role in ["STUDENT", "PARENT"]:
        client = client_for(users[role])
        data = client.get(f"/api/v1/billing/payments/summary/?student={academy['stranger'].pk}").json()
        assert data["balance"] == "300000.00"
        assert data["invoice_count"] == 1
        assert client.get("/api/v1/billing/payments/").json()["count"] == 0
    assert client_for().get("/api/v1/billing/payments/summary/").status_code == 403


def test_summary_adjustments_partial_payment_and_void(academy, users, client_for, debt):
    client = client_for(users["STUDENT"])
    posted = payment(users, academy, [{"invoice": debt.pk, "amount": 100000}], 100000)
    adjust_invoice(users["ACCOUNTANT"], debt, -50000, "Kelishilgan chegirma")
    assert client.get("/api/v1/billing/payments/summary/").json()["balance"] == "150000.00"
    void_payment(users["ACCOUNTANT"], posted, "To‘lov boshqa shaxsga tegishli")
    assert client.get("/api/v1/billing/payments/summary/").json()["balance"] == "250000.00"
    assert client.get("/api/v1/billing/payments/").json()["results"][0]["status"] == "VOID"


def test_summary_pending_and_no_invoices_are_distinct(academy, users, client_for):
    client = client_for(users["STUDENT"])
    empty = client.get("/api/v1/billing/payments/summary/").json()
    assert empty["invoice_count"] == 0 and empty["pending_count"] == 0
    Invoice.objects.create(student=academy["student"], subject=academy["subject"], month=date(2026, 2, 1))
    pending = client.get("/api/v1/billing/payments/summary/").json()
    assert pending["pending_count"] == pending["invoice_count"] == 1
    assert pending["balance"] == "0.00"


def test_summary_due_day_inclusive_and_paid_state(academy, users, client_for, debt, monkeypatch):
    client = client_for(users["STUDENT"])
    monkeypatch.setattr(timezone, "localdate", lambda: date(2026, 2, 10))
    data = client.get("/api/v1/billing/payments/summary/").json()
    assert data["upcoming_balance"] == "300000.00" and data["overdue_balance"] == "0.00"
    monkeypatch.setattr(timezone, "localdate", lambda: date(2026, 2, 11))
    data = client.get("/api/v1/billing/payments/summary/").json()
    assert data["upcoming_balance"] == "0.00" and data["overdue_balance"] == "300000.00"
    payment(users, academy, [{"invoice": debt.pk, "amount": 300000}], 300000)
    assert client.get("/api/v1/billing/payments/summary/").json()["balance"] == "0.00"


def test_payment_course_history_and_filters(academy, users, client_for, debt, django_assert_num_queries):
    Enrollment.objects.create(
        student=academy["student"],
        group=academy["group"],
        start_date=date(2026, 1, 1),
        end_date=date(2026, 2, 15),
        status="ENDED",
    )
    # Later courses must not change the name attached to the older payment period.
    course = Course.objects.create(
        subject=academy["subject"], name="Yangi kurs", slug="new-course", summary="Yangi"
    )
    group = StudyGroup.objects.create(
        name="Yangi guruh",
        course=course,
        teacher=academy["teacher"],
        room=academy["room"],
        capacity=30,
        start_date=date(2026, 3, 1),
    )
    Enrollment.objects.create(student=academy["student"], group=group, start_date=date(2026, 3, 1))
    for _ in range(3):
        payment(users, academy, [{"invoice": debt.pk, "amount": 10000}], 10000)
    client = client_for(users["STUDENT"])
    # Count, payments, allocations and enrollments: independent of the number of payments.
    with django_assert_num_queries(4):
        response = client.get("/api/v1/billing/payments/")
    data = response.json()
    allocation = data["results"][0]["allocations"][0]
    assert data["count"] == 3
    assert data["results"][0]["paid_on"] == "2026-02-09"
    assert allocation["subject_name"] == "Matematika"
    assert allocation["course_names"] == [academy["course"].name]
    assert allocation["month"] == "2026-02-01" and allocation["amount"] == "10000.00"
    assert client.get("/api/v1/billing/payments/?from=2026-02-10").json()["count"] == 0
    assert client.get("/api/v1/billing/payments/?status=VOID").json()["count"] == 0
    assert client.get(f"/api/v1/billing/payments/?student={academy['stranger'].pk}").json()["count"] == 0


def test_subject_filter_and_multiple_allocations(academy, users, client_for, debt):
    subject = Subject.objects.create(name="Tarix", slug="history")
    second = Invoice.objects.create(
        student=academy["student"],
        subject=subject,
        month=debt.month,
        amount=300000,
        due_date=debt.due_date,
        status="CONFIRMED",
    )
    payment(
        users,
        academy,
        [{"invoice": debt.pk, "amount": 100000}, {"invoice": second.pk, "amount": 200000}],
        300000,
    )
    client = client_for(users["STUDENT"])
    response = client.get(f"/api/v1/billing/payments/?subject={subject.pk}").json()
    assert response["count"] == 1
    assert len(response["results"][0]["allocations"]) == 2
    assert response["results"][0]["allocations"][1]["course_names"] == []
    summary = client.get(f"/api/v1/billing/payments/summary/?subject={subject.pk}").json()
    assert summary["balance"] == "100000.00"
    assert len(summary["subjects"]) == 2
    assert client.get("/api/v1/billing/payments/summary/?subject=invalid").status_code == 400
    assert client.get("/api/v1/billing/payments/?subject=-1").status_code == 400
