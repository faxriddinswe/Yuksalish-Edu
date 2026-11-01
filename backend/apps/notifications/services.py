from django.db.models import Q
from apps.accounts.models import User
from apps.students.models import Student
from .models import Notification


def broadcast_permission(actor):
    from common.permissions import has_role, OWNER, ADMIN
    from rest_framework.exceptions import PermissionDenied

    if not actor.is_active or not has_role(actor, OWNER, ADMIN):
        raise PermissionDenied("Umumiy xabarni faqat rahbar yoki administrator yuboradi.")


def broadcast_message(actor, title, message, key):
    from django.db import transaction, IntegrityError
    from rest_framework.exceptions import ValidationError
    from apps.audit.services import audit
    from .models import Broadcast

    broadcast_permission(actor)
    with transaction.atomic():
        # Serialize repeated submissions by this sender, including parallel retries.
        actor = User.objects.select_for_update().get(pk=actor.pk)
        broadcast_permission(actor)
        existing = Broadcast.objects.filter(idempotency_key=key).first()
        if existing:
            if existing.sender_id != actor.pk or existing.title != title or existing.message != message:
                raise ValidationError("So‘rov kaliti boshqa xabar uchun ishlatilgan.")
            return existing, False
        recipients = list(User.objects.filter(is_active=True).order_by("pk").values_list("pk", flat=True))
        try:
            with transaction.atomic():
                broadcast = Broadcast.objects.create(
                    sender=actor,
                    title=title,
                    message=message,
                    idempotency_key=key,
                    recipient_count=len(recipients),
                )
        except IntegrityError:
            raise ValidationError("So‘rov kaliti avval ishlatilgan. Xabarni tekshiring.")
        Notification.objects.bulk_create(
            [
                Notification(
                    recipient_id=recipient,
                    kind="ANNOUNCEMENT",
                    title=title,
                    message=message,
                    broadcast=broadcast,
                    dedupe_key=f"broadcast:{broadcast.pk}:user:{recipient}",
                )
                for recipient in recipients
            ],
            batch_size=500,
        )
        audit(
            actor,
            "notification.broadcasted",
            broadcast,
            after={"title": title, "recipient_count": len(recipients)},
        )
        return broadcast, True


def notify_student(student_id, kind, title, message, key, **related):
    student = Student.objects.get(pk=student_id)
    recipients = User.objects.filter(
        Q(pk=student.user_id) | Q(children_links__student=student), is_active=True
    ).distinct()
    for user in recipients:
        Notification.objects.get_or_create(
            dedupe_key=f"{key}:user:{user.pk}",
            defaults={
                "recipient": user,
                "student": student,
                "kind": kind,
                "title": title,
                "message": f"{student.full_name}: {message}",
                **related,
            },
        )
