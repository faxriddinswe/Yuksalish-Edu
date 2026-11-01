from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_handler
from common.middleware import request_id


class Pagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 50


def exception_handler(exc, context):
    if isinstance(exc, DjangoValidationError):
        exc = ValidationError(exc.message_dict if hasattr(exc, "message_dict") else exc.messages)
    if isinstance(exc, IntegrityError):
        exc = ValidationError("Ma’lumotlar chekloviga zid yoki takroriy yozuv. Qayta tekshiring.")
    response = drf_handler(exc, context)
    if response is None:
        return Response(
            {
                "error": {
                    "message": "Ichki xato. So‘rov ID orqali administratorga murojaat qiling.",
                    "request_id": request_id.get(),
                }
            },
            status=500,
        )
    response.data = {
        "error": {
            "message": "Amal bajarilmadi. Maydonlar va ruxsatlarni tekshiring.",
            "details": response.data,
            "request_id": request_id.get(),
        }
    }
    return response
