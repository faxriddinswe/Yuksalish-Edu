from io import StringIO
from types import SimpleNamespace

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.utils import timezone

from apps.accounts.management.commands import reset_e2e_limits
from apps.accounts.models import RateBucket

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize(
    "debug,database_name,allowed",
    [(True, "yuksalish", False), (False, "e2e_yuksalish", False), (True, "e2e_yuksalish", True)],
)
def test_e2e_limits_reset_is_guarded(monkeypatch, debug, database_name, allowed):
    bucket = RateBucket.objects.create(key="test-limit", count=7, expires_at=timezone.now())
    # Only the command's guard sees this name; queries still use pytest's isolated DB.
    monkeypatch.setattr(
        reset_e2e_limits,
        "settings",
        SimpleNamespace(DEBUG=debug, DATABASES={"default": {"NAME": database_name}}),
    )
    if allowed:
        call_command("reset_e2e_limits", stdout=StringIO())
        assert not RateBucket.objects.filter(pk=bucket.pk).exists()
    else:
        with pytest.raises(CommandError):
            call_command("reset_e2e_limits", stdout=StringIO())
        bucket.refresh_from_db()
        assert bucket.count == 7
