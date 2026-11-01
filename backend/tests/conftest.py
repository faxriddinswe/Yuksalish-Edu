from datetime import date
import pytest
from django.core.cache import cache
from rest_framework.test import APIClient
from apps.accounts.models import User
from apps.students.models import Student, ParentLink
from apps.staff.models import TeacherProfile
from apps.education.models import Subject, SubjectPrice, Course, Room, StudyGroup


@pytest.fixture(autouse=True)
def clear_cache():
    cache.clear()


@pytest.fixture
def users(db):
    data = {}
    for n, role in enumerate(["OWNER_ADMIN", "ADMINISTRATOR", "ACCOUNTANT", "TEACHER", "STUDENT", "PARENT"]):
        data[role] = User.objects.create_user(
            f"+9989011111{n:02d}", "Testing-password-42", full_name=f"Test {role}", roles=[role]
        )
    return data


@pytest.fixture
def academy(users):
    subject = Subject.objects.create(name="Matematika", slug="math")
    SubjectPrice.objects.create(subject=subject, amount=300000, effective_from=date(2020, 1, 1))
    course = Course.objects.create(
        subject=subject, name="Matematika", slug="math", summary="Test kurs", publication_status="PUBLISHED"
    )
    room = Room.objects.create(name="Xona 1", capacity=30)
    teacher = TeacherProfile.objects.create(user=users["TEACHER"], full_name="Test Ustoz", slug="teacher")
    group = StudyGroup.objects.create(
        name="Guruh 1", course=course, room=room, teacher=teacher, capacity=30, start_date=date(2026, 1, 1)
    )
    student = Student.objects.create(
        full_name="Test O‘quvchi", user=users["STUDENT"], registered_on=date(2026, 1, 1)
    )
    stranger = Student.objects.create(full_name="Boshqa O‘quvchi", registered_on=date(2026, 1, 1))
    ParentLink.objects.create(parent=users["PARENT"], student=student, verified_by=users["OWNER_ADMIN"])
    return {
        "subject": subject,
        "course": course,
        "room": room,
        "teacher": teacher,
        "group": group,
        "student": student,
        "stranger": stranger,
    }


@pytest.fixture
def client_for():
    def create(user=None, csrf=False):
        client = APIClient(enforce_csrf_checks=csrf)
        if user:
            client.force_authenticate(user=user)
        return client

    return create
