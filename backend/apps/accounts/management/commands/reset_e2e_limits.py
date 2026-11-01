from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.accounts.models import RateBucket


class Command(BaseCommand):
    help = "Faqat alohida E2E bazasidagi oldingi kirish urinishlarini tozalash."

    def handle(self, *args, **options):
        database_name = str(settings.DATABASES["default"]["NAME"])
        if not settings.DEBUG or not database_name.startswith("e2e_"):
            raise CommandError("Bu amal faqat DEBUG yoqilgan e2e_ bazasida bajariladi.")
        RateBucket.objects.all().delete()
        self.stdout.write("E2E kirish urinishlari tozalandi; limitlar saqlangan.")
