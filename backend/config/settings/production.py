import os
from .base import SECRET_KEY, ALLOWED_HOSTS
from .base import *  # noqa: F403
from django.core.exceptions import ImproperlyConfigured

if (
    len(SECRET_KEY) < 50
    or not os.environ.get("DJANGO_ALLOWED_HOSTS")
    or not os.environ.get("CSRF_TRUSTED_ORIGINS")
):  # noqa: F405
    raise ImproperlyConfigured("Production secret, host va CSRF origin aniq berilishi kerak.")
if "*" in ALLOWED_HOSTS:  # noqa: F405
    raise ImproperlyConfigured("Wildcard host ruxsat etilmaydi.")
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_SSL_REDIRECT = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True

SECURE_REDIRECT_EXEMPT = [r"^api/v1/health/$"]
