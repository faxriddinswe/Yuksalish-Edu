from datetime import date
from decimal import Decimal
from uuid import uuid4
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
import pytest
from django.db import transaction, IntegrityError, close_old_connections
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from apps.education.models import Enrollment, Subject, SubjectPrice, Course, StudyGroup
from apps.education.services import enroll, transfer
from apps.billing.models import Invoice, Payment, PaymentAllocation
from apps.billing.services import (
    generate_month,
    confirm_first,
    record_payment,
    void_payment,
    adjust_invoice,
    send_reminders,
    money,
)
from apps.billing.selectors import invoice_totals
from apps.billing.serializers import InvoiceSerializer
from apps.notifications.models import Notification
from apps.reports.selectors import financial_report
from apps.audit.models import AuditEvent

pytestmark = pytest.mark.django_db


@pytest.fixture
def invoice(academy):
    return Invoice.objects.create(
        student=academy["student"],
        subject=academy["subject"],
        month=date(2026, 2, 1),
        amount=300000,
        due_date=date(2026, 2, 10),
        status="CONFIRMED",
    )


def pay(users, academy, invoice, amount, key=None, actor=None):
    return record_payment(
        actor or users["ACCOUNTANT"],
        academy["student"],
        amount,
        timezone.localdate(),
        [{"invoice": invoice.pk, "amount": amount}],
        key or uuid4(),
    )


def test_first_month_pending_and_normal_tariff(academy, users):
    Enrollment.objects.create(
        student=academy["student"], group=academy["group"], start_date=date(2026, 1, 15)
    )
    assert generate_month(date(2026, 1, 1), users["OWNER_ADMIN"]) == 1
    first = Invoice.objects.get()
    assert first.status == "PENDING" and first.amount is None and first.due_date is None
    confirm_first(users["ACCOUNTANT"], first, 180000, date(2026, 1, 25), "Oy o‘rtasida kelgan")
    assert generate_month(date(2026, 2, 1)) == 1
    assert Invoice.objects.get(month=date(2026, 2, 1)).amount == 300000
    assert generate_month(date(2026, 2, 1)) == 0


def test_two_subjects_600000(academy, users):
    enroll(users["OWNER_ADMIN"], academy["student"], academy["group"], date(2026, 1, 1))
    subject = Subject.objects.create(name="Ingliz tili", slug="english")
    SubjectPrice.objects.create(subject=subject, amount=300000, effective_from=date(2020, 1, 1))
    course = Course.objects.create(subject=subject, name="English", slug="english", summary="Test")
    group = StudyGroup.objects.create(
        name="English A",
        course=course,
        teacher=academy["teacher"],
        room=academy["room"],
        capacity=30,
        start_date=date(2026, 1, 1),
    )
    enroll(users["OWNER_ADMIN"], academy["student"], group, date(2026, 1, 1))
    generate_month(date(2026, 2, 1))
    assert sum(i.amount for i in Invoice.objects.all()) == 600000


def test_partial_full_and_overpayment(users, academy, invoice):
    pay(users, academy, invoice, 100000)
    assert invoice_totals().get().balance == 200000
    with pytest.raises(ValidationError):
        pay(users, academy, invoice, 200001)
    assert Payment.objects.count() == 1
    pay(users, academy, invoice, 200000)
    assert invoice_totals().get().balance == 0
    with pytest.raises(ValidationError):
        pay(users, academy, invoice, 1)


def test_multiple_allocations(users, academy, invoice):
    second = Invoice.objects.create(
        student=academy["student"],
        subject=academy["subject"],
        month=date(2026, 3, 1),
        amount=300000,
        due_date=date(2026, 3, 10),
        status="CONFIRMED",
    )
    record_payment(
        users["ACCOUNTANT"],
        academy["student"],
        400000,
        timezone.localdate(),
        [{"invoice": invoice.pk, "amount": 300000}, {"invoice": second.pk, "amount": 100000}],
        uuid4(),
    )
    assert PaymentAllocation.objects.count() == 2
    assert sum(i.balance for i in invoice_totals()) == 200000


def test_idempotency_and_key_mismatch(users, academy, invoice):
    key = uuid4()
    first, created = pay(users, academy, invoice, 100000, key)
    second, created2 = pay(users, academy, invoice, 100000, key)
    assert created and not created2 and first.pk == second.pk
    with pytest.raises(ValidationError):
        pay(users, academy, invoice, 50000, key)
    assert Payment.objects.count() == 1


@pytest.mark.parametrize("value", ["0", "-1", "nan", "inf", "abc", "1.001", "1000000000000"])
def test_invalid_money(value):
    with pytest.raises(ValidationError):
        money(value)


def test_wrong_allocation_rolls_back(users, academy, invoice):
    with pytest.raises(ValidationError):
        record_payment(
            users["ACCOUNTANT"],
            academy["student"],
            100000,
            timezone.localdate(),
            [{"invoice": invoice.pk, "amount": 99999}],
            uuid4(),
        )
    assert not Payment.objects.exists()


def test_atomic_rollback_on_storage_error(users, academy, invoice, monkeypatch):
    def fail(*args, **kwargs):
        raise RuntimeError("Simulated storage failure")

    monkeypatch.setattr(PaymentAllocation.objects, "create", fail)
    with pytest.raises(RuntimeError):
        pay(users, academy, invoice, 100000)
    assert not Payment.objects.exists() and not PaymentAllocation.objects.exists()


def test_void_and_adjustment_history(users, academy, invoice):
    p, _ = pay(users, academy, invoice, 100000)
    adjust_invoice(users["ACCOUNTANT"], invoice, -50000, "Kelishilgan chegirma")
    assert invoice_totals().get().balance == 150000
    with pytest.raises(ValidationError):
        adjust_invoice(users["ACCOUNTANT"], invoice, -200000, "Noto‘g‘ri")
    void_payment(users["ACCOUNTANT"], p, "To‘lov boshqa o‘quvchiga tegishli")
    assert invoice_totals().get().balance == 250000
    assert PaymentAllocation.objects.count() == 1
    assert AuditEvent.objects.filter(action="payment.voided").exists()


def test_price_change_snapshot(academy):
    Enrollment.objects.create(student=academy["student"], group=academy["group"], start_date=date(2026, 1, 1))
    generate_month(date(2026, 2, 1))
    SubjectPrice.objects.create(subject=academy["subject"], amount=350000, effective_from=date(2026, 3, 1))
    generate_month(date(2026, 3, 1))
    assert Invoice.objects.get(month=date(2026, 2, 1)).amount == 300000
    assert Invoice.objects.get(month=date(2026, 3, 1)).amount == 350000


def test_transfer_does_not_duplicate_invoice(academy, users):
    e = enroll(users["OWNER_ADMIN"], academy["student"], academy["group"], date(2026, 1, 1))
    group = StudyGroup.objects.create(
        name="Math B",
        course=academy["course"],
        teacher=academy["teacher"],
        room=academy["room"],
        capacity=30,
        start_date=date(2026, 1, 1),
    )
    generate_month(date(2026, 2, 1))
    transfer(users["OWNER_ADMIN"], e, group, date(2026, 2, 15), "Yangi vaqt")
    generate_month(date(2026, 2, 1))
    assert Invoice.objects.count() == 1


def test_db_unique_invoice(academy, invoice):
    with pytest.raises(IntegrityError), transaction.atomic():
        Invoice.objects.create(student=academy["student"], subject=academy["subject"], month=invoice.month)


def test_10th_inclusive_and_11th_overdue(invoice, monkeypatch):
    row = invoice_totals().get()
    monkeypatch.setattr(timezone, "localdate", lambda: date(2026, 2, 10))
    assert InvoiceSerializer(row).data["payment_state"] == "UNPAID"
    monkeypatch.setattr(timezone, "localdate", lambda: date(2026, 2, 11))
    assert InvoiceSerializer(row).data["payment_state"] == "OVERDUE"


def test_reminders_5th_partial_and_paid(invoice, users, academy):
    assert send_reminders(date(2026, 2, 4)) == 0
    send_reminders(date(2026, 2, 5))
    send_reminders(date(2026, 2, 5))
    assert Notification.objects.filter(kind="REMINDER").count() == 2
    pay(users, academy, invoice, 100000)
    assert "200,000" in Notification.objects.filter(kind="REMINDER").first().message
    pay(users, academy, invoice, 200000)
    assert not Notification.objects.filter(kind="REMINDER", resolved_at__isnull=True).exists()
    assert send_reminders(date(2026, 2, 6)) == 0


def test_first_month_custom_reminder(academy, users):
    invoice = Invoice.objects.create(
        student=academy["student"], subject=academy["subject"], month=date(2026, 2, 1), is_first_month=True
    )
    confirm_first(users["ACCOUNTANT"], invoice, 120000, date(2026, 2, 22), "Kelishuv")
    send_reminders(date(2026, 2, 16))
    assert not Notification.objects.exists()
    send_reminders(date(2026, 2, 17))
    assert Notification.objects.filter(kind="REMINDER").count() == 2


def test_void_payment_reopens_resolved_reminders(invoice, users, academy):
    send_reminders(date(2026, 2, 5))
    payment, _ = pay(users, academy, invoice, 300000)
    assert not Notification.objects.filter(kind="REMINDER", resolved_at__isnull=True).exists()
    void_payment(users["ACCOUNTANT"], payment, "Noto‘g‘ri to‘lov")
    assert Notification.objects.filter(kind="REMINDER", resolved_at__isnull=True).count() == 2
    assert Notification.objects.filter(kind="PAYMENT_VOID").count() == 2


def test_cash_receipt_and_invoice_month_are_different(invoice, users, academy):
    pay(users, academy, invoice, 100000)
    current = timezone.localdate().replace(day=1)
    report = financial_report({"month": str(current)})
    assert Decimal(report["cash_received"]) == 100000
    assert Decimal(report["paid_for_month"]) == 0
    old = financial_report({"month": str(invoice.month)})
    assert Decimal(old["paid_for_month"]) == 100000
    assert old["student_count"] == 1 and old["partial_students"] == 1


@pytest.mark.django_db(transaction=True)
def test_parallel_payments_preserve_balance(users, academy, invoice):
    barrier = Barrier(2)

    def worker():
        close_old_connections()
        actor = type(users["ACCOUNTANT"]).objects.get(pk=users["ACCOUNTANT"].pk)
        try:
            barrier.wait(timeout=10)
            pay(users, academy, invoice, 200000, actor=actor)
            return "paid"
        except ValidationError:
            return "rejected"
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(lambda _: worker(), range(2)))
    assert sorted(outcomes) == ["paid", "rejected"]
    assert invoice_totals().get().balance == 100000
    assert Payment.objects.count() == 1


def test_previous_debt_drilldown_uses_selected_month(invoice):
    from apps.billing.views import filter_invoices

    qs = filter_invoices(invoice_totals(), {"month": "2026-03-01", "state": "PREVIOUS"})
    assert list(qs.values_list("id", flat=True)) == [invoice.pk]


def test_student_aggregate_state_includes_all_subject_accounts(invoice, academy, users):
    from apps.billing.views import filter_invoices

    Invoice.objects.create(
        student=academy["student"],
        subject=academy["subject"],
        month=date(2026, 3, 1),
        amount=300000,
        due_date=date(2026, 3, 10),
        status="CONFIRMED",
    )
    pay(users, academy, invoice, 300000)
    assert filter_invoices(invoice_totals(), {"student_state": "PARTIAL"}).count() == 2
    assert filter_invoices(invoice_totals(), {"student_state": "PAID"}).count() == 0
