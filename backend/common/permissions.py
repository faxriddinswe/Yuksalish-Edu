from rest_framework.permissions import BasePermission

OWNER = "OWNER_ADMIN"
ADMIN = "ADMINISTRATOR"
ACCOUNTANT = "ACCOUNTANT"
TEACHER = "TEACHER"
STUDENT = "STUDENT"
PARENT = "PARENT"
MANAGEMENT_ROLES = frozenset({OWNER, ADMIN, ACCOUNTANT})


def has_role(user, *roles):
    if not user.is_authenticated or not user.is_active:
        return False
    return bool(set(user.roles).intersection(roles))


def allowed(user, permission, *roles):
    return (
        user.is_authenticated
        and user.is_active
        and (has_role(user, OWNER, *roles) or permission in user.extra_permissions)
    )


def student_scope(user):
    from apps.students.models import Student
    from django.db.models import Q

    if has_role(user, OWNER, ADMIN, ACCOUNTANT):
        return Student.objects.all()
    query = Q(pk__in=private_student_scope(user).values("pk"))
    if has_role(user, TEACHER):
        query |= Q(enrollments__group__teacher__user=user)
    return Student.objects.filter(query).distinct()


def private_student_scope(user):
    from apps.students.models import Student
    from django.db.models import Q

    query = Q(pk__in=[])
    if has_role(user, STUDENT):
        query |= Q(user=user)
    if has_role(user, PARENT):
        query |= Q(parent_links__parent=user)
    return Student.objects.filter(query).distinct()


class OwnerOnly(BasePermission):
    def has_permission(self, request, view):
        return has_role(request.user, OWNER)
