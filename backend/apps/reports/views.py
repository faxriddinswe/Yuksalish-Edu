from pathlib import Path
from django.conf import settings
from django.http import FileResponse
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema
from common.schema import object_schema
from common.permissions import has_role, OWNER, ACCOUNTANT
from common.serializers import serializer_for
from apps.audit.services import audit
from .models import ExportJob
from .selectors import financial_report
from .tasks import build_export
from .workbook import financial_workbook


class FinancialReportView(APIView):
    @extend_schema(
        responses={
            200: object_schema(
                month="string",
                total_students="integer",
                active_students="integer",
                billed="string",
                cash_received="string",
                paid_for_month="string",
                remaining="string",
                previous_debt="string",
                pending_first_invoices="integer",
                invoice_count="integer",
                student_count="integer",
                overdue_students="integer",
                waiting_students="integer",
                overdue_amount="string",
                paid_students="integer",
                partial_students="integer",
                unpaid_students="integer",
                teacher_paid_for_month="string",
                teacher_cash_paid="string",
            )
        }
    )
    def get(self, request):
        if not has_role(request.user, OWNER, ACCOUNTANT):
            raise PermissionDenied()
        return Response(financial_report(request.query_params))


class FinancialDownloadView(APIView):
    @extend_schema(
        responses={(200, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"): bytes}
    )
    def get(self, request):
        if not has_role(request.user, OWNER, ACCOUNTANT):
            raise PermissionDenied()
        output, count = financial_workbook(request.query_params)
        audit(
            request.user,
            "report.downloaded",
            request.user,
            after={"filters": request.query_params.dict(), "invoice_rows": count},
        )
        return FileResponse(
            output,
            as_attachment=True,
            filename=f"yuksalish-hisobot-{request.query_params.get('month') or 'joriy-oy'}.xlsx",
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )


class ExportViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = serializer_for(ExportJob, ["filters", "status", "row_count"])

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return ExportJob.objects.none()
        if not has_role(self.request.user, OWNER, ACCOUNTANT):
            raise PermissionDenied()
        return ExportJob.objects.filter(requested_by=self.request.user)

    def create(self, request):
        if not has_role(request.user, OWNER, ACCOUNTANT):
            raise PermissionDenied()
        filters = {
            k: str(v)
            for k, v in request.data.items()
            if k in ["month", "subject", "student", "group", "teacher", "state", "search"]
        }
        financial_report(filters)  # Validate filters before queueing.
        job = ExportJob.objects.create(requested_by=request.user, filters=filters)
        audit(request.user, "report.export_requested", job, after=filters)
        try:
            build_export.delay(job.pk)
        except Exception:
            job.status = "FAILED"
            job.save()
            raise ValidationError("Eksport navbatiga ulanib bo‘lmadi. Worker/Redis holatini tekshiring.")
        return Response(self.get_serializer(job).data, status=202)

    @action(detail=True, methods=["get"])
    def download(self, request, pk=None):
        job = self.get_object()
        if job.status != "COMPLETED":
            raise ValidationError("Eksport hali tayyor emas.")
        path = Path(settings.BASE_DIR) / "private_exports" / job.filename
        if not path.exists():
            raise ValidationError("Eksport fayli saqlash muddatidan chiqqan. Qayta eksport qiling.")
        audit(request.user, "report.export_downloaded", job)
        return FileResponse(path.open("rb"), as_attachment=True, filename=f"yuksalish-hisoblar-{job.pk}.xlsx")
