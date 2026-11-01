import json
from pathlib import Path
from django.conf import settings
from django.contrib.sessions.backends.db import SessionStore
from django.contrib.auth import SESSION_KEY, BACKEND_SESSION_KEY, HASH_SESSION_KEY
from django.core.management.base import BaseCommand, CommandError
from apps.accounts.models import User
from apps.audit.services import audit


class Command(BaseCommand):
    help = "Faqat lokal muhit uchun yuklama sessiyalarini tayyorlaydi; o‘quvchi yaratmaydi."

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("Production’da taqiqlangan.")
        if not str(settings.DATABASES["default"]["NAME"]).startswith("load_"):
            raise CommandError(
                "Yuklama akkauntlari faqat alohida load_ bazasida yaratiladi. Asosiy bazaga yozilmadi."
            )
        sessions = []
        for i in range(100):
            user, created = User.objects.get_or_create(
                phone=f"+99890500{i:04d}",
                defaults={
                    "full_name": f"Demo Yuklama xodimi {i + 1:03d}",
                    "roles": ["ADMINISTRATOR", "ACCOUNTANT"],
                    "is_test_account": True,
                },
            )
            if not created and (not user.is_test_account or not user.is_active):
                raise CommandError("Mavjud oddiy yoki nofaol akkauntdan yuklama sessiyasi yaratilmaydi.")
            if created:
                user.set_unusable_password()
                user.save()
                audit(user, "account.demo_load_created", user)
            session = SessionStore()
            session[SESSION_KEY] = str(user.pk)
            session[BACKEND_SESSION_KEY] = "django.contrib.auth.backends.ModelBackend"
            session[HASH_SESSION_KEY] = user.get_session_auth_hash()
            session.set_expiry(3600)
            session.save()
            sessions.append(session.session_key)
        folder = Path(settings.BASE_DIR).parent / ".local"
        folder.mkdir(exist_ok=True)
        target = folder / "load-sessions.json"
        target.write_text(json.dumps(sessions))
        target.chmod(0o600)
        self.stdout.write(
            "100 lokal yuklama sessiyasi tayyor. Tokenlar logga chiqarilmadi. O‘quvchi soni o‘zgarmadi."
        )
