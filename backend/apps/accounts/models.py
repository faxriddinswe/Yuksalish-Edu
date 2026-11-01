import re
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.core.exceptions import ValidationError
from django.db import models
from common.models import Timestamped

ROLES = ["OWNER_ADMIN", "ADMINISTRATOR", "ACCOUNTANT", "TEACHER", "STUDENT", "PARENT"]
EXTRA_PERMISSIONS = [
    "billing.record_payment",
    "billing.backdate_payment",
    "billing.correct_finance",
    "attendance.correct_attendance",
]


def normalize_phone(value):
    digits = re.sub(r"[\s()+-]", "", str(value))
    if str(value).strip().startswith("+") and not digits.startswith("998"):
        raise ValidationError("Telefon +998 bilan boshlanishi kerak.")
    if re.fullmatch(r"\d{9}", digits):
        digits = "998" + digits
    if not re.fullmatch(r"998\d{9}", digits):
        raise ValidationError("Telefonni +998 XX XXX XX XX ko‘rinishida kiriting.")
    return "+" + digits


class UserManager(BaseUserManager):
    def create_user(self, phone, password=None, **extra):
        user = self.model(phone=normalize_phone(phone), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, phone, password=None, **extra):
        extra.update(is_staff=True, is_superuser=True, is_active=True)
        return self.create_user(phone, password, **extra)


class User(AbstractBaseUser, PermissionsMixin, Timestamped):
    phone = models.CharField(max_length=16, unique=True)
    full_name = models.CharField(max_length=180)
    roles = models.JSONField(default=list, blank=True)
    extra_permissions = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_test_account = models.BooleanField(default=False)
    activated_at = models.DateTimeField(null=True, blank=True)
    objects = UserManager()
    USERNAME_FIELD = "phone"
    REQUIRED_FIELDS = ["full_name"]

    def clean(self):
        self.phone = normalize_phone(self.phone)
        if not isinstance(self.roles, list) or set(self.roles) - set(ROLES):
            raise ValidationError("Noto‘g‘ri rol.")
        if not isinstance(self.extra_permissions, list) or set(self.extra_permissions) - set(
            EXTRA_PERMISSIONS
        ):
            raise ValidationError("Noto‘g‘ri vakolat.")

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.full_name


class AccountInvitation(Timestamped):
    user = models.OneToOneField(User, on_delete=models.PROTECT, related_name="invitation")
    code_hash = models.CharField(max_length=256)
    purpose = models.CharField(max_length=12, choices=[("ACTIVATE", "Faollashtirish"), ("RESET", "Tiklash")])
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    used_at = models.DateTimeField(null=True, blank=True)
    issued_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name="issued_invitations")


class RateBucket(models.Model):
    key = models.CharField(max_length=64, unique=True)
    count = models.PositiveIntegerField(default=0)
    expires_at = models.DateTimeField()
