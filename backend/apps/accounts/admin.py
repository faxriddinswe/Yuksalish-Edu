from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User


@admin.register(User)
class TechnicalUserAdmin(UserAdmin):
    ordering = ["id"]
    list_display = ["id", "phone", "full_name", "is_active", "is_staff"]
    fieldsets = (
        (None, {"fields": ("phone", "full_name", "password")}),
        ("Texnik boshqaruv", {"fields": ("is_active", "is_staff", "is_superuser")}),
    )
    add_fieldsets = ((None, {"fields": ("phone", "full_name", "password1", "password2")}),)
    search_fields = ["phone", "full_name"]
    filter_horizontal = ()
