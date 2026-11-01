from common.permissions import OWNER, ADMIN, has_role
from apps.students.models import Student
from .models import Achievement


def achievement_scope(user):
    queryset = Achievement.objects.select_related("subject", "teacher", "student")
    if not user.is_authenticated:
        return queryset.none()
    if has_role(user, OWNER, ADMIN):
        return queryset
    return queryset.filter(teacher__user=user)


def teacher_students(user):
    if not user.is_authenticated:
        return Student.objects.none()
    return Student.objects.filter(enrollments__group__teacher__user=user).distinct()


def student_certificates(user):
    return achievement_scope(user).filter(is_sample=False).exclude(image="")
