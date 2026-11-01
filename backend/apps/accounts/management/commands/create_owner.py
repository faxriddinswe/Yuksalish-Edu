import getpass
from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth.password_validation import validate_password
from apps.accounts.models import User
from apps.audit.services import audit


class Command(BaseCommand):
    help = "Mahsulot rahbari akkauntini yaratadi; Django superuser emas."

    def add_arguments(self, parser):
        parser.add_argument("--phone", required=True)
        parser.add_argument("--name", required=True)

    def handle(self, *args, **options):
        password = getpass.getpass("Parol (ekranga chiqmaydi): ")
        if password != getpass.getpass("Parolni takrorlang: "):
            raise CommandError("Parollar mos emas.")
        user = User(phone=options["phone"], full_name=options["name"])
        validate_password(password, user)
        user = User.objects.create_user(
            phone=options["phone"], password=password, full_name=options["name"], roles=["OWNER_ADMIN"]
        )
        audit(user, "account.owner_created", user)
        self.stdout.write(self.style.SUCCESS("Rahbar akkaunti yaratildi."))
