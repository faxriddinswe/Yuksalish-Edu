from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from decimal import Decimal
from io import BytesIO
from uuid import uuid4

import pytest
from django.db import close_old_connections, connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from openpyxl import load_workbook

from apps.audit.models import AuditEvent
from apps.accounts.models import User
from apps.staff.models import TeacherProfile
from apps.billing.models import Invoice, Payment, TeacherPayment
from apps.billing.services import record_payment
from apps.billing.teacher_payments import record_teacher_payment
from apps.education.models import Enrollment, StudyGroup, Subject
from apps.reports.models import ExportJob
from apps.reports.selectors import financial_report
from apps.reports.tasks import build_export
from apps.students.models import Student

pytestmark = pytest.mark.django_db


def invoice(academy, subject=None, amount="100.10", due_offset=0):
    today = timezone.localdate()
    return Invoice.objects.create(
        student=academy["student"],
        subject=subject or academy["subject"],
        month=today.replace(day=1),
        amount=amount,
        due_date=today + timedelta(days=due_offset),
        status="CONFIRMED",
    )


def payout_data(academy, **overrides):
    today = timezone.localdate()
    return {
        "teacher": academy["teacher"].pk,
        "month": str(today.replace(day=1)),
        "paid_on": str(today),
        "amount": "1500000.25",
        "note": "Oylik / avans",
        **overrides,
    }


@pytest.mark.parametrize("role", ["ADMINISTRATOR", "TEACHER", "STUDENT", "PARENT"])
def test_teacher_finance_is_private(academy, users, client_for, role):
    client = client_for(users[role])
    for path in [
        "staff/teacher-finance/",
        "billing/teacher-payments/",
        "reports/financial/download/",
        f"billing/payments/options/?student={academy['student'].pk}",
    ]:
        assert client.get(f"/api/v1/{path}").status_code == 403
    assert (
        client.post(
            "/api/v1/billing/teacher-payments/",
            payout_data(academy),
            format="json",
            HTTP_IDEMPOTENCY_KEY=str(uuid4()),
        ).status_code
        == 403
    )


def test_teacher_payout_idempotency_and_audit(academy, users, client_for):
    client = client_for(users["ACCOUNTANT"])
    key = str(uuid4())
    data = payout_data(academy)
    first = client.post("/api/v1/billing/teacher-payments/", data, format="json", HTTP_IDEMPOTENCY_KEY=key)
    assert first.status_code == 201, first.data
    repeat = client.post("/api/v1/billing/teacher-payments/", data, format="json", HTTP_IDEMPOTENCY_KEY=key)
    assert repeat.status_code == 200 and repeat.data["id"] == first.data["id"]
    conflict = client.post(
        "/api/v1/billing/teacher-payments/",
        {**data, "amount": "99.00"},
        format="json",
        HTTP_IDEMPOTENCY_KEY=key,
    )
    assert conflict.status_code == 400
    assert TeacherPayment.objects.count() == 1
    assert AuditEvent.objects.filter(action="teacher_payment.posted").count() == 1
    stats = client.get(f"/api/v1/staff/teacher-finance/{academy['teacher'].pk}/").data
    assert Decimal(stats["paid_for_month"]) == Decimal("1500000.25")
    assert Decimal(stats["total_paid"]) == Decimal("1500000.25")


@pytest.mark.parametrize(
    "override",
    [
        {"amount": "0"},
        {"amount": "-1"},
        {"amount": "1.001"},
        {"month": "2026-01-02"},
        {"paid_on": "2099-01-01"},
        {"note": "x" * 501},
    ],
)
def test_invalid_teacher_payout_never_writes(academy, users, client_for, override):
    response = client_for(users["ACCOUNTANT"]).post(
        "/api/v1/billing/teacher-payments/",
        payout_data(academy, **override),
        format="json",
        HTTP_IDEMPOTENCY_KEY=str(uuid4()),
    )
    assert response.status_code == 400
    assert not TeacherPayment.objects.exists()


def test_void_teacher_payout_preserves_history_and_excludes_totals(academy, users, client_for):
    client = client_for(users["ACCOUNTANT"])
    payment = client.post(
        "/api/v1/billing/teacher-payments/",
        payout_data(academy),
        format="json",
        HTTP_IDEMPOTENCY_KEY=str(uuid4()),
    ).data
    path = f"/api/v1/billing/teacher-payments/{payment['id']}/void/"
    assert client.post(path, {"reason": ""}, format="json").status_code == 400
    assert client.post(path, {"reason": "Xato summa"}, format="json").status_code == 200
    owner = client_for(users["OWNER_ADMIN"])
    assert owner.post(path, {"reason": ""}, format="json").status_code == 400
    assert owner.post(path, {"reason": "Xato summa"}, format="json").status_code == 200
    assert owner.post(path, {"reason": "Xato summa"}, format="json").status_code == 200
    saved = TeacherPayment.objects.get(pk=payment["id"])
    assert saved.status == "VOID" and saved.void_reason == "Xato summa"
    assert AuditEvent.objects.filter(action="teacher_payment.voided").count() == 1
    stats = client.get(f"/api/v1/staff/teacher-finance/{academy['teacher'].pk}/").data
    assert Decimal(stats["paid_for_month"]) == 0
    assert Decimal(stats["total_paid"]) == 0


def test_inactive_teacher_cannot_receive_new_payout(academy, users, client_for):
    academy["teacher"].is_active = False
    academy["teacher"].save()
    response = client_for(users["ACCOUNTANT"]).post(
        "/api/v1/billing/teacher-payments/",
        payout_data(academy),
        format="json",
        HTTP_IDEMPOTENCY_KEY=str(uuid4()),
    )
    assert response.status_code == 400 and not TeacherPayment.objects.exists()


def test_teacher_unique_current_students_and_bounded_queries(academy, users, client_for):
    today = timezone.localdate()
    group = academy["group"]
    second = StudyGroup.objects.create(
        name="Ikkinchi",
        course=academy["course"],
        room=academy["room"],
        teacher=academy["teacher"],
        capacity=30,
        start_date=today,
    )
    for target in [group, second]:
        Enrollment.objects.create(student=academy["student"], group=target, start_date=today)
    Enrollment.objects.create(student=academy["stranger"], group=group, start_date=today + timedelta(days=1))
    old = Student.objects.create(full_name="Yakunlagan", registered_on=today)
    Enrollment.objects.create(
        student=old,
        group=group,
        start_date=today - timedelta(days=2),
        end_date=today - timedelta(days=1),
        status="ENDED",
    )
    client = client_for(users["ACCOUNTANT"])
    with CaptureQueriesContext(connection) as captured:
        response = client.get("/api/v1/staff/teacher-finance/")
    assert response.status_code == 200
    assert response.data["results"][0]["student_count"] == 1
    assert response.data["results"][0]["group_count"] == 2
    assert len(captured) <= 4


@pytest.mark.parametrize("search", ["ALIYEV", "aliyev", "  ShAhZoD   aLiYeV  ", "Aliyev Shahzod"])
def test_student_lookup_ignores_case_and_word_order(academy, users, client_for, search):
    student = Student.objects.create(full_name="Shahzod Aliyev", registered_on=timezone.localdate())
    result = client_for(users["ACCOUNTANT"]).get("/api/v1/students/", {"search": search})
    assert result.status_code == 200 and result.data["count"] == 1
    assert result.data["results"][0]["id"] == student.pk


def test_teacher_name_search_does_not_match_number_in_other_phones(academy, users, client_for):
    academy["teacher"].full_name = "Demo Ustoz 1"
    academy["teacher"].save()
    another = User.objects.create_user("+998901000001", full_name="Demo Ustoz 2", roles=["TEACHER"])
    TeacherProfile.objects.create(user=another, full_name="Demo Ustoz 2", slug="another-teacher")
    client = client_for(users["ACCOUNTANT"])
    result = client.get("/api/v1/staff/teacher-finance/", {"search": "dEMo uSTOz 1"})
    assert result.status_code == 200 and result.data["count"] == 1
    assert result.data["results"][0]["id"] == academy["teacher"].pk
    result = client.get("/api/v1/staff/teacher-finance/", {"search": another.phone})
    assert result.data["count"] == 1 and result.data["results"][0]["full_name"] == "Demo Ustoz 2"


def test_quick_payment_allocates_exactly_and_retries_without_duplicate(academy, users, client_for):
    first = invoice(academy, due_offset=-2)
    subject = Subject.objects.create(name="Ingliz", slug="english-quick")
    second = invoice(academy, subject, amount="200.20", due_offset=-1)
    client = client_for(users["ACCOUNTANT"])
    data = {"student": academy["student"].pk, "amount": "150.15", "paid_on": str(timezone.localdate())}
    key = str(uuid4())
    first_response = client.post("/api/v1/billing/payments/", data, format="json", HTTP_IDEMPOTENCY_KEY=key)
    assert first_response.status_code == 201, first_response.data
    amounts = {part["invoice"]: part["amount"] for part in first_response.data["allocations"]}
    assert amounts == {first.pk: "100.10", second.pk: "50.05"}
    repeat = client.post("/api/v1/billing/payments/", data, format="json", HTTP_IDEMPOTENCY_KEY=key)
    assert repeat.status_code == 200 and repeat.data["id"] == first_response.data["id"]
    assert Payment.objects.count() == 1
    options = client.get("/api/v1/billing/payments/options/", {"student": academy["student"].pk})
    assert Decimal(options.data["balance"]) == Decimal("150.15")


def test_quick_payment_overpayment_rolls_back(academy, users, client_for):
    invoice(academy)
    response = client_for(users["ACCOUNTANT"]).post(
        "/api/v1/billing/payments/",
        {"student": academy["student"].pk, "amount": "100.11", "paid_on": str(timezone.localdate())},
        format="json",
        HTTP_IDEMPOTENCY_KEY=str(uuid4()),
    )
    assert response.status_code == 400
    assert not Payment.objects.exists()


def test_quick_payment_spans_more_than_one_page(academy, users):
    for index in range(30):
        subject = Subject.objects.create(name=f"Fan {index}", slug=f"quick-{index}")
        invoice(academy, subject, amount="10.00")
    payment, created = record_payment(
        users["ACCOUNTANT"], academy["student"], "260.00", timezone.localdate(), None, uuid4()
    )
    assert created and payment.allocations.count() == 26
    assert sum(payment.allocations.values_list("amount", flat=True)) == Decimal("260.00")


@pytest.mark.django_db(transaction=True)
def test_parallel_quick_payment_is_idempotent(academy, users, client_for):
    invoice(academy)
    data = {"student": academy["student"].pk, "amount": "50.00", "paid_on": str(timezone.localdate())}
    key = str(uuid4())

    def post(_):
        close_old_connections()
        try:
            response = client_for(users["ACCOUNTANT"]).post(
                "/api/v1/billing/payments/", data, format="json", HTTP_IDEMPOTENCY_KEY=key
            )
            return response.status_code, response.data.get("id")
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(post, range(2)))
    assert sorted(code for code, _ in results) == [200, 201]
    assert len({pk for _, pk in results}) == Payment.objects.count() == 1


def test_filtered_cash_and_teacher_subject_do_not_include_other_subjects(academy, users):
    first = invoice(academy, amount="100.00")
    other_subject = Subject.objects.create(name="Boshqa fan", slug="report-other")
    second = invoice(academy, other_subject, amount="200.00")
    Enrollment.objects.create(student=academy["student"], group=academy["group"], start_date=first.month)
    record_payment(
        users["ACCOUNTANT"],
        academy["student"],
        "100.00",
        timezone.localdate(),
        [{"invoice": first.pk, "amount": "30.00"}, {"invoice": second.pk, "amount": "70.00"}],
        uuid4(),
    )
    for filters in [
        {"subject": first.subject_id},
        {"teacher": academy["teacher"].pk},
        {"group": academy["group"].pk},
    ]:
        report = financial_report(filters)
        assert Decimal(report["cash_received"]) == 30
        assert Decimal(report["billed"]) == 100
        assert report["invoice_count"] == 1


@pytest.mark.django_db(transaction=True)
def test_workbook_totals_dates_numbers_and_formula_safety(academy, users, client_for, settings, tmp_path):
    academy["student"].full_name = "=SUM(1,2)"
    academy["student"].save()
    bill = invoice(academy, amount="100.10")
    record_payment(users["ACCOUNTANT"], academy["student"], "25.05", timezone.localdate(), None, uuid4())
    today = timezone.localdate()
    record_teacher_payment(
        users["ACCOUNTANT"], academy["teacher"], today.replace(day=1), today, "10.25", "+malicious", uuid4()
    )
    filters = {"month": str(bill.month)}
    report = financial_report(filters)
    response = client_for(users["ACCOUNTANT"]).get("/api/v1/reports/financial/download/", filters)
    assert response.status_code == 200
    assert "attachment" in response["Content-Disposition"]
    book = load_workbook(BytesIO(b"".join(response.streaming_content)), data_only=False)
    response.close()
    assert {
        "Statistika",
        "Hisoblar",
        "O‘quvchilar",
        "Tushumlar",
        "Oldingi qarz",
        "Tuzatishlar",
        "Ustozlar - davr",
        "Ustozlar - sana",
        "Izohlar",
    } == set(book.sheetnames)
    metrics = {row[0]: row[1] for row in book["Statistika"].iter_rows(min_row=2, values_only=True)}
    assert Decimal(str(metrics["Oy uchun hisoblangan"])) == Decimal(report["billed"])
    assert Decimal(str(metrics["Shu oy ichida tushgan pul"])) == Decimal(report["cash_received"])
    assert Decimal(str(metrics["Hisoblar qoldig‘i"])) == Decimal(report["remaining"])
    assert Decimal(str(metrics["Ustozlarga shu oy uchun berilgan"])) == Decimal("10.25")
    assert book["Hisoblar"]["B2"].value == "'=SUM(1,2)" and book["Hisoblar"]["B2"].data_type == "s"
    assert book["Hisoblar"]["E2"].data_type == "n" and book["Hisoblar"]["D2"].is_date
    assert book["Ustozlar - davr"]["G2"].value == "'+malicious"
    assert sum(
        Decimal(str(row[6])) for row in book["Tushumlar"].iter_rows(min_row=2, values_only=True)
    ) == Decimal(report["cash_received"])
    book.close()
    settings.BASE_DIR = tmp_path
    job = ExportJob.objects.create(requested_by=users["ACCOUNTANT"], filters=filters)
    build_export(job.pk)
    job.refresh_from_db()
    assert job.status == "COMPLETED" and job.row_count == 1
    assert (tmp_path / "private_exports" / job.filename).is_file()


def test_teacher_period_and_actual_cash_date_are_separate(academy, users):
    today = timezone.localdate()
    month = today.replace(day=1)
    previous = (month - timedelta(days=1)).replace(day=1)
    record_teacher_payment(
        users["ACCOUNTANT"], academy["teacher"], previous, today, "150.50", "Oldingi oy uchun", uuid4()
    )
    current = financial_report({"month": str(month)})
    old = financial_report({"month": str(previous)})
    assert (
        Decimal(current["teacher_cash_paid"]) == Decimal(old["teacher_paid_for_month"]) == Decimal("150.50")
    )
    assert Decimal(current["teacher_paid_for_month"]) == Decimal(old["teacher_cash_paid"]) == 0


def test_export_rejects_invalid_filters(academy, users, client_for):
    client = client_for(users["ACCOUNTANT"])
    for filters in [{"month": "invalid"}, {"teacher": "x"}, {"state": "INVALID"}]:
        assert client.get("/api/v1/reports/financial/download/", filters).status_code == 400
