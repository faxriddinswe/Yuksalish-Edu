from django.conf import settings
from django.db import models


class AuditEvent(models.Model):
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True)
    action = models.CharField(max_length=80, db_index=True)
    entity_type = models.CharField(max_length=80)
    entity_id = models.CharField(max_length=80)
    occurred_at = models.DateTimeField(auto_now_add=True, db_index=True)
    before = models.JSONField(default=dict)
    after = models.JSONField(default=dict)
    reason = models.TextField(blank=True)
    request_id = models.CharField(max_length=36, blank=True)

    class Meta:
        ordering = ["-id"]
