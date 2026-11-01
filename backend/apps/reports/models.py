from django.conf import settings
from django.db import models
from common.models import Timestamped


class ExportJob(Timestamped):
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    filters = models.JSONField(default=dict)
    status = models.CharField(max_length=12, default="PENDING")
    filename = models.CharField(max_length=100, blank=True)
    row_count = models.PositiveIntegerField(default=0)
