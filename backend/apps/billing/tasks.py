from datetime import date
from celery import shared_task
from django.core.cache import cache
from django.utils import timezone
from django.db import OperationalError
from apps.education.models import Enrollment
from .services import generate_month, send_reminders


@shared_task(bind=True, autoretry_for=(ConnectionError, OperationalError), retry_backoff=True, max_retries=5)
def daily_catch_up(self):
    first = Enrollment.objects.order_by("start_date").values_list("start_date", flat=True).first()
    month = first.replace(day=1) if first else timezone.localdate().replace(day=1)
    current = timezone.localdate().replace(day=1)
    while month <= current:
        generate_month(month)
        month = date(month.year + 1, 1, 1) if month.month == 12 else date(month.year, month.month + 1, 1)
    send_reminders()
    cache.set("scheduler:last_success", timezone.now().isoformat(), timeout=172800)


@shared_task
def heartbeat():
    cache.set("worker:last_seen", timezone.now().isoformat(), timeout=180)
