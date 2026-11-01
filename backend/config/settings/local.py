from .base import *  # noqa: F403

DEBUG = True
if os.getenv("LOCAL_MEMORY_CACHE") == "1":  # noqa: F405
    CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}

# Development server threadlari connection to‘plamasligi uchun.
DATABASES["default"]["CONN_MAX_AGE"] = 0  # noqa: F405
