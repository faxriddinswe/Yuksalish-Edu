from django.conf import settings
from django.db import models
from common.models import Timestamped


class Student(Timestamped):
    full_name = models.CharField(max_length=180, db_index=True)
    phone = models.CharField(max_length=16, blank=True, db_index=True)
    contact_phone = models.CharField(max_length=16, blank=True)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="student_profile",
    )
    registered_on = models.DateField()
    status = models.CharField(
        max_length=12,
        choices=[("ACTIVE", "Faol"), ("INACTIVE", "Nofaol"), ("ARCHIVED", "Arxiv")],
        default="ACTIVE",
        db_index=True,
    )
    internal_notes = models.TextField(blank=True)

    def __str__(self):
        return self.full_name


class ParentLink(Timestamped):
    parent = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="children_links"
    )
    student = models.ForeignKey(Student, on_delete=models.PROTECT, related_name="parent_links")
    relationship = models.CharField(max_length=80, default="Ota-ona / vasiy")
    verified_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")

    class Meta:
        ordering = ["-id"]
        constraints = [models.UniqueConstraint(fields=["parent", "student"], name="unique_parent_child")]
