from datetime import date
from decimal import Decimal
from tempfile import SpooledTemporaryFile

from django.db import connection, transaction
from django.utils import timezone
from openpyxl import Workbook
from openpyxl.cell import WriteOnlyCell
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter

from apps.billing.models import Adjustment
from apps.billing.serializers import InvoiceSerializer
from .selectors import financial_report, report_scope, teacher_payment_scope


def safe_cell(value):
    if isinstance(value, str) and value.lstrip().startswith(("=", "+", "-", "@", "\t", "\r")):
        return "'" + value
    return value


def sheet(workbook, title, headings):
    result = workbook.create_sheet(title)
    result.freeze_panes = "A2"
    for index, text in enumerate(headings, 1):
        result.column_dimensions[get_column_letter(index)].width = min(48, max(19, len(text) + 4))
        if text in ["O‘quvchi", "Ustoz", "Kiritgan xodim", "Tasdiqlagan xodim"]:
            result.column_dimensions[get_column_letter(index)].width = 34
        elif text in ["Izoh", "Sabab"]:
            result.column_dimensions[get_column_letter(index)].width = 55
    cells = []
    for heading in headings:
        cell = WriteOnlyCell(result, value=heading)
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="0F766E")
        cell.alignment = Alignment(wrap_text=True, vertical="top")
        cells.append(cell)
    result.append(cells)
    return result


def append_row(target, values):
    cells = []
    for value in values:
        cell = WriteOnlyCell(target, value=safe_cell(value))
        if isinstance(value, str):
            cell.alignment = Alignment(wrap_text=True, vertical="top")
        if isinstance(value, Decimal):
            cell.number_format = "#,##0.00"
        elif isinstance(value, date):
            cell.number_format = "yyyy-mm-dd"
        cells.append(cell)
    target.append(cells)


METRICS = {
    "billed": "Oy uchun hisoblangan",
    "cash_received": "Shu oy ichida tushgan pul",
    "paid_for_month": "Shu oy hisoblari uchun to‘langan",
    "remaining": "Hisoblar qoldig‘i",
    "previous_debt": "Oldingi oylardan qarz",
    "overdue_amount": "Muddati o‘tgan summa",
    "pending_first_invoices": "Summasi belgilanmagan hisoblar",
    "invoice_count": "Tanlangan hisoblar soni",
    "student_count": "Tanlangan hisoblardagi noyob o‘quvchilar",
    "paid_students": "To‘liq to‘lagan o‘quvchilar",
    "partial_students": "Qisman to‘lagan o‘quvchilar",
    "unpaid_students": "To‘lamagan yoki hisobi belgilanmagan",
    "overdue_students": "Muddati o‘tgan o‘quvchilar",
    "waiting_students": "Muddati kelmagan qoldiqli o‘quvchilar",
    "total_students": "Markazdagi jami o‘quvchilar",
    "active_students": "Markazdagi faol o‘quvchilar",
    "teacher_paid_for_month": "Ustozlarga shu oy uchun berilgan",
    "teacher_cash_paid": "Shu oy ichida ustozlarga berilgan",
}


def financial_workbook(params):
    """Build all sheets from the same database snapshot, without a worker dependency."""
    owns_transaction = not connection.in_atomic_block
    output = SpooledTemporaryFile(max_size=8 * 1024 * 1024, mode="w+b")
    try:
        with transaction.atomic():
            if owns_transaction:
                with connection.cursor() as cursor:
                    cursor.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ")
            start, invoices, all_invoices, cash = report_scope(params)
            report = financial_report(params)
            workbook = Workbook(write_only=True)
            info = sheet(workbook, "Statistika", ["Ko‘rsatkich", "Qiymat", "Birlik"])
            info.column_dimensions["A"].width = 52
            info.column_dimensions["B"].width = 27
            append_row(info, ["Hisobot oyi", start, ""])
            append_row(
                info, ["Tayyorlangan vaqt (Toshkent)", timezone.localtime().strftime("%Y-%m-%d %H:%M:%S"), ""]
            )
            for key, label in METRICS.items():
                value = report[key]
                append_row(
                    info,
                    [
                        label,
                        Decimal(value) if isinstance(value, str) else value,
                        "so‘m" if isinstance(value, str) else "ta",
                    ],
                )

            headings = [
                "ID",
                "O‘quvchi",
                "Fan",
                "Oy",
                "Hisob (so‘m)",
                "Tuzatish (so‘m)",
                "To‘langan (so‘m)",
                "Qoldiq (so‘m)",
                "Muddat",
                "Holat",
            ]
            details = sheet(workbook, "Hisoblar", headings)
            previous_sheet = sheet(workbook, "Oldingi qarz", headings)
            serializer = InvoiceSerializer()
            states = {
                "PENDING": "Belgilanishi kerak",
                "PAID": "To‘langan",
                "OVERDUE": "Muddati o‘tgan",
                "PARTIAL": "Qisman to‘langan",
                "UNPAID": "To‘lanmagan",
            }

            def invoice_values(invoice):
                return [
                    invoice.pk,
                    invoice.student.full_name,
                    invoice.subject.name,
                    invoice.month,
                    invoice.amount,
                    invoice.adjustment_total,
                    invoice.paid_total,
                    invoice.balance,
                    invoice.due_date,
                    states[serializer.get_payment_state(invoice)],
                ]

            students = {}
            count = 0
            for invoice in invoices.order_by("student__full_name", "student_id", "month", "id").iterator(
                chunk_size=500
            ):
                append_row(details, invoice_values(invoice))
                count += 1
                person = students.setdefault(
                    invoice.student_id,
                    {
                        "name": invoice.student.full_name,
                        "phone": invoice.student.phone or invoice.student.contact_phone,
                        "billed": Decimal(0),
                        "paid": Decimal(0),
                        "balance": Decimal(0),
                        "pending": 0,
                        "count": 0,
                    },
                )
                person["billed"] += invoice.total_amount or 0
                person["paid"] += invoice.paid_total
                person["balance"] += invoice.balance or 0
                person["pending"] += invoice.status == "PENDING"
                person["count"] += 1
            people = sheet(
                workbook,
                "O‘quvchilar",
                [
                    "ID",
                    "O‘quvchi",
                    "Telefon",
                    "Hisoblangan (so‘m)",
                    "To‘langan (so‘m)",
                    "Qoldiq (so‘m)",
                    "Belgilanmagan hisoblar",
                    "Jami hisoblar",
                    "To‘lov holati",
                ],
            )
            for student_id, person in students.items():
                state = (
                    "To‘liq to‘lagan"
                    if not person["pending"] and person["balance"] <= 0
                    else "Qisman to‘lagan"
                    if person["paid"] > 0
                    else "To‘lamagan / belgilanmagan"
                )
                append_row(
                    people,
                    [
                        student_id,
                        person["name"],
                        person["phone"],
                        person["billed"],
                        person["paid"],
                        person["balance"],
                        person["pending"],
                        person["count"],
                        state,
                    ],
                )
            for invoice in (
                all_invoices.filter(status="CONFIRMED", month__lt=start, balance__gt=0)
                .order_by("month", "id")
                .iterator(chunk_size=500)
            ):
                append_row(previous_sheet, invoice_values(invoice))

            payments = sheet(
                workbook,
                "Tushumlar",
                [
                    "To‘lov ID",
                    "Haqiqiy to‘lov sanasi",
                    "O‘quvchi",
                    "Fan",
                    "Hisob oyi",
                    "Hisob ID",
                    "Taqsimlangan summa (so‘m)",
                    "Kiritgan xodim",
                    "Izoh",
                ],
            )
            for allocation in (
                cash.select_related("payment__student", "payment__entered_by", "invoice__subject")
                .order_by("payment__paid_on", "payment_id", "id")
                .iterator(chunk_size=500)
            ):
                append_row(
                    payments,
                    [
                        allocation.payment_id,
                        allocation.payment.paid_on,
                        allocation.payment.student.full_name,
                        allocation.invoice.subject.name,
                        allocation.invoice.month,
                        allocation.invoice_id,
                        allocation.amount,
                        allocation.payment.entered_by.full_name,
                        allocation.payment.note,
                    ],
                )

            corrections = sheet(
                workbook,
                "Tuzatishlar",
                [
                    "ID",
                    "Hisob ID",
                    "O‘quvchi",
                    "Fan",
                    "Hisob oyi",
                    "Tuzatish (so‘m)",
                    "Sabab",
                    "Tasdiqlagan xodim",
                    "Kiritilgan sana",
                ],
            )
            for adjustment in (
                Adjustment.objects.filter(invoice_id__in=invoices.values("pk"))
                .select_related("invoice__student", "invoice__subject", "approved_by")
                .order_by("id")
                .iterator(chunk_size=500)
            ):
                append_row(
                    corrections,
                    [
                        adjustment.pk,
                        adjustment.invoice_id,
                        adjustment.invoice.student.full_name,
                        adjustment.invoice.subject.name,
                        adjustment.invoice.month,
                        adjustment.amount,
                        adjustment.reason,
                        adjustment.approved_by.full_name,
                        timezone.localtime(adjustment.created_at).date(),
                    ],
                )

            payout_headings = [
                "ID",
                "Ustoz",
                "To‘lov davri",
                "Haqiqiy to‘lov sanasi",
                "Summa (so‘m)",
                "Kiritgan xodim",
                "Izoh",
            ]
            for title, queryset in [
                ("Ustozlar - davr", teacher_payment_scope(params).filter(month=start)),
                (
                    "Ustozlar - sana",
                    teacher_payment_scope(params).filter(
                        paid_on__year=start.year, paid_on__month=start.month
                    ),
                ),
            ]:
                payouts = sheet(workbook, title, payout_headings)
                for payout in (
                    queryset.select_related("teacher", "entered_by")
                    .order_by("paid_on", "pk")
                    .iterator(chunk_size=500)
                ):
                    append_row(
                        payouts,
                        [
                            payout.pk,
                            payout.teacher.full_name,
                            payout.month,
                            payout.paid_on,
                            payout.amount,
                            payout.entered_by.full_name,
                            payout.note,
                        ],
                    )

            notes = sheet(workbook, "Izohlar", ["Bo‘lim", "Mazmuni"])
            notes.column_dimensions["A"].width = 36
            notes.column_dimensions["B"].width = 110
            for row in [
                [
                    "Filtrlar",
                    "; ".join(f"{key}: {value}" for key, value in params.items() if value)
                    or "Tanlangan joriy oy, barcha fanlar",
                ],
                [
                    "Hisoblangan / qoldiq",
                    "Hisob oyiga tegishli. Summasi belgilanmagan hisob nol deb tasdiqlanmaydi; uning soni alohida ko‘rsatilgan.",
                ],
                [
                    "Tushum",
                    "To‘lovning haqiqiy sanasi bo‘yicha. Filtrga tushgan taqsimot summasi olinadi; boshqa fanlarga to‘langan qism qo‘shilmaydi. Bekor to‘lovlar hisoblanmaydi.",
                ],
                [
                    "Shu oy uchun to‘langan",
                    "Tanlangan oy hisoblariga qilingan barcha amaldagi to‘lovlar, haqiqiy to‘lov sanasidan qat’i nazar.",
                ],
                [
                    "Oldingi qarz",
                    "Tanlangan oydan oldingi tasdiqlangan hisoblarning hozirgi musbat qoldig‘i.",
                ],
                [
                    "Markazdagi jami/faol o‘quvchilar",
                    "Butun markaz bo‘yicha. Tanlangan hisoblardagi noyob o‘quvchilar boshqa qatorda sanalgan.",
                ],
                [
                    "Ustoz to‘lovlari",
                    "Davr va haqiqiy sana alohida varaqlarda. Ustoz filtri qo‘llanadi; to‘lov fan, guruh yoki alohida o‘quvchiga sun’iy taqsimlanmaydi. Bekor yozuvlar jami summaga kirmaydi. Oylik qarz yoki ish haqi avtomatik hisoblanmaydi.",
                ],
                [
                    "Bir xillik",
                    "Statistika va tafsilotlar bazaning bitta holatidan olingan. Sonlar va summalar Excel sonlari sifatida saqlangan.",
                ],
            ]:
                append_row(notes, row)
            workbook.save(output)
            output.seek(0)
            return output, count
    except Exception:
        output.close()
        raise
