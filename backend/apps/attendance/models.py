from django.conf import settings
from django.db import models
from common.models import Timestamped


class AttendanceStatus(models.TextChoices):
    PRESENT = "PRESENT", "Qatnashgan"
    ABSENT = "ABSENT", "Qatnashmagan"
    LATE = "LATE", "Kechikkan"
    EXCUSED = "EXCUSED", "Sababli"


class Attendance(Timestamped):
    lesson = models.ForeignKey("education.Lesson", on_delete=models.PROTECT, related_name="attendance")
    student = models.ForeignKey("students.Student", on_delete=models.PROTECT)
    enrollment = models.ForeignKey("education.Enrollment", on_delete=models.PROTECT)
    status = models.CharField(
        max_length=12,
        choices=AttendanceStatus.choices,
    )
    note = models.CharField(max_length=500, blank=True)
    marked_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")

    class Meta:
        ordering = ["-id"]
        constraints = [
            models.UniqueConstraint(fields=["lesson", "student"], name="attendance_lesson_student")
        ]
        permissions = [("correct_attendance", "Davomatni tuzatish")]
