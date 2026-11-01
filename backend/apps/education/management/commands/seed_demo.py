import os
import uuid
from datetime import date, datetime, time, timedelta
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from apps.accounts.models import User
from apps.students.models import Student, ParentLink
from apps.staff.models import TeacherProfile
from apps.education.models import Subject, SubjectPrice, Course, Room, StudyGroup, Enrollment, Lesson
from apps.education.services import save_lesson
from apps.attendance.services import mark_attendance
from apps.billing.models import Invoice, Payment
from apps.billing.services import (
    generate_month,
    confirm_first,
    record_payment,
    opening_balance,
    send_reminders,
)
from apps.content.models import SiteSettings, FAQ
from apps.leads.models import Lead


class Command(BaseCommand):
    help = "Faqat lokal/test muhit uchun takrorlanmaydigan sun’iy demo ma’lumotlar."

    def add_arguments(self, parser):
        parser.add_argument("--students", type=int, default=100)

    @transaction.atomic
    def handle(self, *args, **options):
        if not settings.DEBUG or os.getenv("DJANGO_SETTINGS_MODULE", "").endswith("production"):
            raise CommandError("Production’da demo ma’lumot yaratish taqiqlangan.")
        password = os.getenv("DEMO_PASSWORD")
        if not password or len(password) < 10:
            raise CommandError(
                "DEMO_PASSWORD muhit orqali kamida 10 belgili lokal parol bering. Parol logga chiqmaydi."
            )
        if not 1 <= options["students"] <= 10000:
            raise CommandError("O‘quvchi soni 1–10 000 oralig‘ida bo‘lsin.")
        today = timezone.localdate()
        current = today.replace(day=1)
        previous = (current - timedelta(days=1)).replace(day=1)
        start = (previous - timedelta(days=1)).replace(day=1)

        def user(phone, name, roles):
            obj, created = User.objects.get_or_create(
                phone=phone, defaults={"full_name": name, "roles": roles}
            )
            if created:
                obj.set_password(password)
                obj.activated_at = timezone.now()
                obj.save()
            return obj

        owner = user("+998900000001", "Demo Rahbar", ["OWNER_ADMIN"])
        user("+998900000002", "Demo Administrator", ["ADMINISTRATOR"])
        accountant = user("+998900000003", "Demo Buxgalter", ["ACCOUNTANT"])
        accountant.extra_permissions = ["billing.backdate_payment", "billing.correct_finance"]
        accountant.save()
        student_user = user("+998900000004", "Demo O‘quvchi", ["STUDENT"])
        parent = user("+998900000005", "Demo Ota-ona", ["PARENT"])
        subjects = []
        groups = []
        teachers = []
        names = [
            ("english", "Ingliz tili"),
            ("uzbek", "Ona tili"),
            ("math", "Matematika"),
            ("chemistry", "Kimyo"),
            ("biology", "Biologiya"),
            ("history", "Tarix"),
            ("korean", "Koreys tili"),
        ]
        for n, (slug, name) in enumerate(names):
            subject, _ = Subject.objects.get_or_create(slug=slug, defaults={"name": name})
            subjects.append(subject)
            SubjectPrice.objects.get_or_create(
                subject=subject, effective_from=date(2020, 1, 1), defaults={"amount": 300000}
            )
            teacher_user = user(f"+99890100000{n}", f"Demo Ustoz {n + 1}", ["TEACHER"])
            teacher, _ = TeacherProfile.objects.get_or_create(
                user=teacher_user,
                defaults={
                    "full_name": teacher_user.full_name,
                    "slug": f"demo-teacher-{n + 1}",
                    "biography": "Sun’iy demo profil. Haqiqiy ustoz haqidagi ma’lumot emas.",
                    "publication_status": "PUBLISHED",
                },
            )
            teacher.subjects.add(subject)
            teachers.append(teacher)
            course, _ = Course.objects.get_or_create(
                slug=slug,
                defaults={
                    "subject": subject,
                    "name": name,
                    "summary": f"{name} bo‘yicha o‘rganish yo‘nalishi. Namuna kurs ma’lumotlari.",
                    "description": "Bu sun’iy demo kurs. Markaz tasdiqlagan dastur, dars tartibi va ustozlar ishga tushirishdan oldin kiritiladi.",
                    "audience": "Yo‘nalishga qiziquvchi o‘quvchilar.",
                    "publication_status": "PUBLISHED",
                    "featured": n < 3,
                },
            )
            course.teachers.add(teacher)
            for g in range(8):
                room, _ = Room.objects.get_or_create(name=f"Demo xona {g + 1}", defaults={"capacity": 40})
                group, _ = StudyGroup.objects.get_or_create(
                    name=f"Demo {name} {g + 1}",
                    defaults={
                        "course": course,
                        "teacher": teacher,
                        "room": room,
                        "capacity": 40,
                        "start_date": start,
                    },
                )
                groups.append(group)
        for i in range(options["students"]):
            student, _ = Student.objects.get_or_create(
                full_name=f"Demo O‘quvchi {i + 1:04d}",
                defaults={"registered_on": start, "contact_phone": "+998900000005" if i < 2 else ""},
            )
            if i == 0 and not student.user_id:
                student.user = student_user
                student.save()
            if i < 2:
                ParentLink.objects.get_or_create(
                    parent=parent, student=student, defaults={"verified_by": owner}
                )
            indices = [i % len(groups)]
            if i % 3 == 0:
                indices.append((i + 8) % len(groups))
            for index in indices:
                Enrollment.objects.get_or_create(
                    student=student, group=groups[index], defaults={"start_date": start}
                )
        generate_month(start, owner)
        generate_month(previous, owner)
        generate_month(current, owner)
        for invoice in Invoice.objects.filter(
            status="PENDING", student__full_name__startswith="Demo O‘quvchi "
        ).order_by("pk"):
            if invoice.student_id % 10 != 0:
                confirm_first(
                    accountant, invoice, 300000, invoice.month.replace(day=10), "Demo birinchi oy kelishuvi"
                )
        invoices = Invoice.objects.filter(
            status="CONFIRMED", is_opening_balance=False, student__full_name__startswith="Demo O‘quvchi "
        ).order_by("id")
        for invoice in invoices:
            amount = 300000 if invoice.student_id % 4 == 0 else 100000 if invoice.student_id % 4 == 1 else 0
            key = uuid.uuid5(uuid.NAMESPACE_URL, f"yuksalish-demo-payment:{invoice.pk}")
            if amount and not Payment.objects.filter(idempotency_key=key).exists():
                record_payment(
                    accountant,
                    invoice.student,
                    amount,
                    today,
                    [{"invoice": invoice.pk, "amount": amount}],
                    key,
                    "Sun’iy demo to‘lov",
                )
        first_student = Student.objects.get(full_name="Demo O‘quvchi 0001")
        opening_month = (start - timedelta(days=1)).replace(day=1)
        if not Invoice.objects.filter(
            student=first_student, subject=subjects[0], month=opening_month
        ).exists():
            opening_balance(
                accountant,
                first_student,
                subjects[0],
                opening_month,
                150000,
                opening_month.replace(day=10),
                start,
                "Demo tizimga o‘tishdagi eski qarz",
            )
        for i, group in enumerate(groups):
            lesson_day = today + timedelta(days=i // 4)
            hour = 8 + (i % 4) * 2
            key = f"demo-lesson:{group.pk}:{lesson_day}"
            if not Lesson.objects.filter(source_key=key).exists():
                start_at = timezone.make_aware(datetime.combine(lesson_day, time(hour)))
                lesson = save_lesson(
                    owner,
                    {
                        "group": group,
                        "teacher": group.teacher,
                        "room": group.room,
                        "starts_at": start_at,
                        "ends_at": start_at + timedelta(hours=1),
                        "source_key": key,
                    },
                )
                for enrollment in group.enrollments.all()[:5]:
                    mark_attendance(group.teacher.user, lesson, enrollment.student, "PRESENT")
        for n in range(12):
            Lead.objects.get_or_create(
                dedupe_key=f"demo-lead-{n}",
                defaults={
                    "full_name": f"Demo Murojaatchi {n + 1}",
                    "phone": f"+9989020000{n:02d}",
                    "course": groups[n].course,
                    "consent": True,
                },
            )
        SiteSettings.objects.get_or_create(
            pk=1,
            defaults={
                "announcement": "",
                "about": "Yuksalish Edu — fanlarni izchil o‘rganishga yo‘naltirilgan repetitorlik o‘quv markazi. Kursni tanlang, jadval va guruhni administrator bilan kelishing. O‘quvchi hamda biriktirilgan ota-ona dars jadvali, davomat va to‘lov holatini shaxsiy kabinetda kuzatishi mumkin.",
            },
        )
        FAQ.objects.get_or_create(
            question="Kursga qanday yozilaman?",
            defaults={
                "answer": "Kursni tanlab murojaat qoldiring. Administrator siz bilan bog‘lanadi.",
                "publication_status": "PUBLISHED",
            },
        )
        FAQ.objects.get_or_create(
            question="Kabinetni qanday faollashtiraman?",
            defaults={
                "answer": "Administrator bergan telefon va bir martalik kod orqali parol belgilang.",
                "publication_status": "PUBLISHED",
            },
        )
        send_reminders()
        self.stdout.write(
            self.style.SUCCESS(
                f"Demo tayyor: {Student.objects.count()} o‘quvchi. Parollar chiqarilmadi. Haqiqiy odam ma’lumotlari ishlatilmadi."
            )
        )
