from django.conf import settings
from django.db import models
from common.models import Timestamped


class TeacherProfile(Timestamped):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="teacher_profile"
    )
    full_name = models.CharField(max_length=180)
    slug = models.SlugField(unique=True)
    subjects = models.ManyToManyField("education.Subject", blank=True)
    biography = models.TextField(blank=True)
    experience_years = models.PositiveSmallIntegerField(null=True, blank=True)
    students_taught = models.PositiveIntegerField(null=True, blank=True)
    qualifications = models.TextField(blank=True)
    photo = models.ImageField(upload_to="teachers/", blank=True)
    public_phone = models.CharField(max_length=16, blank=True)
    publication_status = models.CharField(
        max_length=12, choices=[("DRAFT", "Qoralama"), ("PUBLISHED", "E’lon qilingan")], default="DRAFT"
    )
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.full_name
