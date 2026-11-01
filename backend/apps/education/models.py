from django.db import models
from django.db.models import Q, F
from django.core.validators import MinValueValidator, MaxValueValidator
from common.models import Timestamped


class Subject(Timestamped):
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(unique=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class SubjectPrice(Timestamped):
    subject = models.ForeignKey(Subject, on_delete=models.PROTECT, related_name="prices")
    amount = models.DecimalField(max_digits=14, decimal_places=2, validators=[MinValueValidator(1)])
    effective_from = models.DateField()

    class Meta:
        ordering = ["-id"]
        constraints = [
            models.UniqueConstraint(fields=["subject", "effective_from"], name="subject_price_date"),
            models.CheckConstraint(condition=Q(amount__gt=0), name="positive_subject_price"),
        ]


class Course(Timestamped):
    subject = models.ForeignKey(Subject, on_delete=models.PROTECT, related_name="courses")
    name = models.CharField(max_length=150)
    slug = models.SlugField(unique=True)
    summary = models.CharField(max_length=320)
    description = models.TextField(blank=True)
    audience = models.TextField(blank=True)
    duration = models.CharField(max_length=120, blank=True)
    lesson_description = models.CharField(max_length=180, blank=True)
    teachers = models.ManyToManyField("staff.TeacherProfile", blank=True, related_name="courses")
    featured = models.BooleanField(default=False)
    publication_status = models.CharField(
        max_length=12, choices=[("DRAFT", "Qoralama"), ("PUBLISHED", "E’lon qilingan")], default="DRAFT"
    )
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class Room(Timestamped):
    name = models.CharField(max_length=80, unique=True)
    capacity = models.PositiveSmallIntegerField(validators=[MinValueValidator(1)])
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class StudyGroup(Timestamped):
    name = models.CharField(max_length=100)
    course = models.ForeignKey(Course, on_delete=models.PROTECT, related_name="groups")
    teacher = models.ForeignKey("staff.TeacherProfile", on_delete=models.PROTECT, related_name="groups")
    room = models.ForeignKey(Room, on_delete=models.PROTECT)
    capacity = models.PositiveSmallIntegerField(validators=[MinValueValidator(1)])
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=12,
        choices=[("ACTIVE", "Faol"), ("COMPLETED", "Yakunlangan"), ("ARCHIVED", "Arxiv")],
        default="ACTIVE",
    )

    class Meta:
        ordering = ["-id"]
        constraints = [
            models.CheckConstraint(
                condition=Q(end_date__isnull=True) | Q(end_date__gte=F("start_date")), name="group_date_order"
            )
        ]

    def __str__(self):
        return self.name


class EnrollmentStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "Faol"
    ENDED = "ENDED", "Yakunlangan"


class Enrollment(Timestamped):
    student = models.ForeignKey("students.Student", on_delete=models.PROTECT, related_name="enrollments")
    group = models.ForeignKey(StudyGroup, on_delete=models.PROTECT, related_name="enrollments")
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=12, choices=EnrollmentStatus.choices, default="ACTIVE")

    class Meta:
        ordering = ["-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["student", "group"], condition=Q(status="ACTIVE"), name="active_student_group"
            ),
            models.CheckConstraint(
                condition=Q(end_date__isnull=True) | Q(end_date__gte=F("start_date")),
                name="enrollment_date_order",
            ),
        ]


class ScheduleRule(Timestamped):
    group = models.ForeignKey(StudyGroup, on_delete=models.PROTECT, related_name="schedule_rules")
    weekday = models.PositiveSmallIntegerField(validators=[MaxValueValidator(6)])
    start_time = models.TimeField()
    end_time = models.TimeField()
    valid_from = models.DateField()
    valid_until = models.DateField()

    class Meta:
        ordering = ["-id"]
        constraints = [
            models.CheckConstraint(condition=Q(end_time__gt=F("start_time")), name="rule_time_order"),
            models.CheckConstraint(condition=Q(valid_until__gte=F("valid_from")), name="rule_date_order"),
        ]


class Lesson(Timestamped):
    group = models.ForeignKey(StudyGroup, on_delete=models.PROTECT, related_name="lessons")
    room = models.ForeignKey(Room, on_delete=models.PROTECT)
    teacher = models.ForeignKey("staff.TeacherProfile", on_delete=models.PROTECT)
    starts_at = models.DateTimeField(db_index=True)
    ends_at = models.DateTimeField()
    status = models.CharField(
        max_length=12,
        choices=[("SCHEDULED", "Rejalangan"), ("COMPLETED", "O‘tilgan"), ("CANCELLED", "Bekor qilingan")],
        default="SCHEDULED",
    )
    source_key = models.CharField(max_length=160, unique=True, null=True, blank=True)

    class Meta:
        ordering = ["-id"]
        constraints = [
            models.CheckConstraint(condition=Q(ends_at__gt=F("starts_at")), name="lesson_time_order")
        ]
        indexes = [models.Index(fields=["room", "starts_at"]), models.Index(fields=["teacher", "starts_at"])]
