import hashlib
import secrets
from datetime import timedelta
from django.contrib.auth.hashers import make_password, check_password
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, Throttled, ValidationError
from common.permissions import has_role, OWNER, ADMIN
from apps.audit.services import audit
from .models import AccountInvitation, RateBucket, User, normalize_phone


def rate_limit(key, limit=10, seconds=900):
    digest = hashlib.sha256(key.encode()).hexdigest()
    now = timezone.now()
    with transaction.atomic():
        RateBucket.objects.get_or_create(
            key=digest, defaults={"expires_at": now + timedelta(seconds=seconds)}
        )
        bucket = RateBucket.objects.select_for_update().get(key=digest)
        if bucket.expires_at <= now:
            bucket.count = 0
            bucket.expires_at = now + timedelta(seconds=seconds)
        bucket.count += 1
        bucket.save()
        exceeded = bucket.count > limit
    if exceeded:
        raise Throttled(detail="Urinishlar chegarasiga yetdingiz. Keyinroq qayta urinib ko‘ring.")


def issue_invitation(actor, user, purpose="ACTIVATE"):
    if not has_role(actor, OWNER, ADMIN):
        raise PermissionDenied()
    if not has_role(actor, OWNER) and OWNER in user.roles:
        raise PermissionDenied("Xodim taklifini faqat rahbar boshqaradi.")
    if not user.is_active:
        raise ValidationError("Akkaunt nofaol.")
    if purpose not in ["ACTIVATE", "RESET"]:
        raise ValidationError("Noto‘g‘ri taklif turi.")
    code = secrets.token_urlsafe(18)
    with transaction.atomic():
        User.objects.select_for_update().get(pk=user.pk)
        AccountInvitation.objects.update_or_create(
            user=user,
            defaults={
                "code_hash": make_password(code),
                "purpose": purpose,
                "expires_at": timezone.now() + timedelta(hours=24),
                "attempts": 0,
                "used_at": None,
                "issued_by": actor,
            },
        )
        audit(actor, "account.invitation_issued", user, after={"purpose": purpose})
    return code


def redeem_invitation(phone, code, password, purpose):
    phone = normalize_phone(phone)
    error = "Taklif yaroqsiz yoki muddati tugagan."
    with transaction.atomic():
        invitation = (
            AccountInvitation.objects.select_for_update()
            .select_related("user")
            .filter(user__phone=phone)
            .first()
        )
        if not invitation:
            make_password("dummy-invitation-check")
        elif (
            not invitation.used_at
            and invitation.expires_at > timezone.now()
            and invitation.attempts < 5
            and invitation.purpose == purpose
            and invitation.user.is_active
        ):
            invitation.attempts += 1
            invitation.save(update_fields=["attempts"])
            if check_password(str(code), invitation.code_hash):
                validate_password(password, invitation.user)
                user = invitation.user
                user.set_password(password)
                user.activated_at = timezone.now()
                user.save()
                invitation.used_at = timezone.now()
                invitation.save(update_fields=["used_at"])
                audit(user, "account.activated" if purpose == "ACTIVATE" else "account.password_reset", user)
                return user
    raise ValidationError(error)
