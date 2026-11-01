from pathlib import Path
import shutil
from celery import shared_task
from django.conf import settings
from apps.audit.services import audit
from .models import ExportJob
from .workbook import financial_workbook, safe_cell  # noqa: F401


@shared_task
def build_export(job_id):
    job = ExportJob.objects.select_related("requested_by").get(pk=job_id)
    from common.permissions import has_role, OWNER, ACCOUNTANT

    if not job.requested_by.is_active or not has_role(job.requested_by, OWNER, ACCOUNTANT):
        job.status = "FAILED"
        job.save()
        return
    job.status = "RUNNING"
    job.save()
    try:
        destination = Path(settings.BASE_DIR) / "private_exports"
        destination.mkdir(mode=0o700, exist_ok=True)
        job.filename = f"export-{job.pk}.xlsx"
        output, count = financial_workbook(job.filters)
        with output:
            with (destination / job.filename).open("wb") as target:
                shutil.copyfileobj(output, target)
        (destination / job.filename).chmod(0o600)
        job.row_count = count
        job.status = "COMPLETED"
        job.save()
        audit(job.requested_by, "report.export_completed", job, after={"rows": count})
    except Exception:
        job.status = "FAILED"
        job.save()
        raise
