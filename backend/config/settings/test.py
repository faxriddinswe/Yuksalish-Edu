import os

os.environ.setdefault("DJANGO_SECRET_KEY", "test-only-key-never-use-in-production")
from .base import *  # noqa: F403,E402

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
CELERY_TASK_ALWAYS_EAGER = True

DATABASES["default"]["CONN_MAX_AGE"] = 0  # noqa: F405
