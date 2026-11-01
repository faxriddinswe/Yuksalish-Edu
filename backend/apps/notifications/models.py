from django.conf import settings
from django.db import models
from common.models import Timestamped


class Broadcast(Timestamped):
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="broadcasts")
    title = models.CharField(max_length=180)
    message = models.TextField(max_length=5000)
    recipient_count = models.PositiveIntegerField()
    idempotency_key = models.UUIDField(unique=True)


class Notification(Timestamped):
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="notifications"
    )
    student = models.ForeignKey("students.Student", on_delete=models.PROTECT, null=True, blank=True)
    kind = models.CharField(max_length=30)
    title = models.CharField(max_length=180)
    message = models.TextField()
    invoice = models.ForeignKey("billing.Invoice", on_delete=models.PROTECT, null=True, blank=True)
    lesson = models.ForeignKey("education.Lesson", on_delete=models.PROTECT, null=True, blank=True)
    broadcast = models.ForeignKey(Broadcast, on_delete=models.PROTECT, null=True, blank=True)
    dedupe_key = models.CharField(max_length=200, unique=True)
    read_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
