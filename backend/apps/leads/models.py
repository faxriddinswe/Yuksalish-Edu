from django.conf import settings
from django.db import models
from common.models import Timestamped


class Lead(Timestamped):
    full_name = models.CharField(max_length=180)
    phone = models.CharField(max_length=16, db_index=True)
    course = models.ForeignKey("education.Course", on_delete=models.PROTECT, null=True, blank=True)
    comment = models.CharField(max_length=1000, blank=True)
    consent = models.BooleanField()
    status = models.CharField(
        max_length=12,
        choices=[
            ("NEW", "Yangi"),
            ("CONTACTED", "Bog‘lanilgan"),
            ("ENROLLED", "Qabul qilingan"),
            ("CLOSED", "Yopilgan"),
        ],
        default="NEW",
        db_index=True,
    )
    assigned_to = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True)
    internal_notes = models.TextField(blank=True)
    converted_student = models.ForeignKey("students.Student", on_delete=models.PROTECT, null=True, blank=True)
    dedupe_key = models.CharField(max_length=64, unique=True)
