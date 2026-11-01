from django.core.management.base import BaseCommand
from django.db import transaction
from django.contrib.sessions.models import Session
from django.contrib.auth import SESSION_KEY
from apps.accounts.models import User
from apps.students.models import Student, ParentLink
from apps.staff.models import TeacherProfile
from apps.audit.services import audit


class Command(BaseCommand):
    help = (
        "Eski yuklama sinovi akkauntlarini ma’lumotlarni o‘chirmasdan nofaol qiladi; odatda faqat tekshiradi."
    )

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true")

    @transaction.atomic
    def handle(self, *args, **options):
        candidates = []
        for index in range(100):
            user = (
                User.objects.select_for_update()
                .filter(phone=f"+99890500{index:04d}", full_name=f"Demo Yuklama xodimi {index + 1:03d}")
                .first()
            )
            if not user or user.has_usable_password():
                continue
            if (
                Student.objects.filter(user=user).exists()
                or TeacherProfile.objects.filter(user=user).exists()
                or ParentLink.objects.filter(parent=user).exists()
            ):
                continue
            candidates.append(user)
        changed = [
            user
            for user in candidates
            if user.is_active or user.roles or user.extra_permissions or not user.is_test_account
        ]
        revoked = 0
        if options["apply"]:
            for user in changed:
                before = {
                    "roles": user.roles,
                    "extra_permissions": user.extra_permissions,
                    "is_active": user.is_active,
                }
                user.roles = []
                user.extra_permissions = []
                user.is_active = False
                user.is_test_account = True
                user.save(
                    update_fields=["roles", "extra_permissions", "is_active", "is_test_account", "updated_at"]
                )
                audit(
                    None,
                    "account.load_retired",
                    user,
                    before=before,
                    after={"roles": [], "is_active": False, "is_test_account": True},
                )
            ids = {str(user.pk) for user in candidates}
            for session in Session.objects.iterator():
                if session.get_decoded().get(SESSION_KEY) in ids:
                    session.delete()
                    revoked += 1
        self.stdout.write(
            f"Yuklama akkauntlari: {len(candidates)}; {'nofaol qilindi' if options['apply'] else 'o‘zgaradi'}: {len(changed)}; bekor qilingan sessiya: {revoked}. Oddiy akkauntlar va biznes yozuvlari saqlandi."
        )
