from django.core.cache import cache
from django.db import connection
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema
from common.schema import object_schema
from common.permissions import has_role, OWNER


class HealthView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = []

    @extend_schema(
        responses={
            200: object_schema(status="string", database="string"),
            503: object_schema(status="string"),
        }
    )
    def get(self, request):
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
            return Response({"status": "ok", "database": "ready"})
        except Exception:
            return Response({"status": "unavailable"}, status=503)


class OperationsView(APIView):
    @extend_schema(responses={200: object_schema(worker_last_seen="string", scheduler_last_success="string")})
    def get(self, request):
        from rest_framework.exceptions import PermissionDenied

        if not has_role(request.user, OWNER):
            raise PermissionDenied()
        try:
            return Response(
                {
                    "worker_last_seen": cache.get("worker:last_seen"),
                    "scheduler_last_success": cache.get("scheduler:last_success"),
                }
            )
        except Exception:
            return Response({"error": {"message": "Redis bilan aloqa yo‘q."}}, status=503)
