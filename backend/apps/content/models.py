from django.db import models
from django.db.models import Q
from django.core.validators import RegexValidator
from common.models import Timestamped


class SiteSettings(Timestamped):
    name = models.CharField(max_length=80, default="Yuksalish Edu", editable=False)
    about = models.TextField(
        default="Bilim va maqsad sari birga. Yuksalish Edu — repetitorlik o‘quv markazi."
    )
    public_phone = models.CharField(max_length=16, blank=True)
    address = models.CharField(max_length=300, blank=True)
    working_hours = models.CharField(max_length=180, blank=True)
    map_url = models.URLField(blank=True)
    telegram_url = models.URLField(
        blank=True,
        max_length=500,
        validators=[
            RegexValidator(
                r"\Ahttps://(?:t\.me|telegram\.me)(?:/|$)",
                "Telegram uchun https://t.me/ havolasini kiriting.",
            )
        ],
    )
    instagram_url = models.URLField(
        blank=True,
        max_length=500,
        validators=[
            RegexValidator(
                r"\Ahttps://(?:www\.)?instagram\.com(?:/|$)",
                "Instagram uchun https://www.instagram.com/ havolasini kiriting.",
            )
        ],
    )
    linkedin_url = models.URLField(
        blank=True,
        max_length=500,
        validators=[
            RegexValidator(
                r"\Ahttps://(?:www\.)?linkedin\.com(?:/|$)",
                "LinkedIn uchun https://www.linkedin.com/ havolasini kiriting.",
            )
        ],
    )
    announcement = models.CharField(max_length=250, blank=True)
    headline = models.CharField(max_length=180, default="Katta maqsadlar bilimdan boshlanadi.")
    introduction = models.TextField(blank=True)
    mission = models.TextField(blank=True)
    teaching_approach = models.TextField(blank=True)
    facilities = models.TextField(blank=True)
    admission_steps = models.TextField(blank=True)
    cover_image = models.ImageField(upload_to="center/", blank=True)
    about_image = models.ImageField(upload_to="center/", blank=True)
    image_caption = models.CharField(max_length=180, blank=True)


class FAQ(Timestamped):
    question = models.CharField(max_length=250)
    answer = models.TextField()
    position = models.PositiveSmallIntegerField(default=0)
    publication_status = models.CharField(
        max_length=12, choices=[("DRAFT", "Qoralama"), ("PUBLISHED", "E’lon qilingan")], default="DRAFT"
    )

    class Meta:
        ordering = ["position", "id"]


class Achievement(Timestamped):
    import_key = models.CharField(max_length=180, unique=True, null=True, blank=True, editable=False)
    display_name = models.CharField(max_length=180)
    title = models.CharField(max_length=200)
    description = models.TextField()
    score = models.CharField(max_length=60, blank=True)
    is_sample = models.BooleanField(default=False)
    student = models.ForeignKey(
        "students.Student", on_delete=models.PROTECT, null=True, blank=True, related_name="certificates"
    )
    subject = models.ForeignKey("education.Subject", on_delete=models.PROTECT)
    teacher = models.ForeignKey("staff.TeacherProfile", on_delete=models.PROTECT, null=True, blank=True)
    achieved_on = models.DateField(null=True, blank=True)
    image = models.ImageField(upload_to="achievements/", blank=True)
    consent_record = models.TextField(blank=True)
    privacy_reviewed = models.BooleanField(default=False)
    publication_status = models.CharField(
        max_length=12, choices=[("DRAFT", "Qoralama"), ("PUBLISHED", "E’lon qilingan")], default="DRAFT"
    )

    class Meta:
        ordering = ["-id"]
        constraints = [
            models.CheckConstraint(
                condition=Q(publication_status="DRAFT") | (Q(privacy_reviewed=True) & ~Q(consent_record="")),
                name="achievement_publish_consent",
            )
        ]
