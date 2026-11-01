import json
import os
import ipaddress
import logging
import uuid
from contextvars import ContextVar

request_id = ContextVar("request_id", default="")


class JsonFormatter(logging.Formatter):
    def format(self, record):
        # Do not serialize request bodies, SQL, cookies or exception text.
        return json.dumps(
            {
                "level": record.levelname,
                "logger": record.name,
                "message": record.getMessage() if record.name == "yuksalish.request" else record.name,
                "request_id": request_id.get(),
            }
        )


class RequestMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        token = request_id.set(str(uuid.uuid4()))
        request.request_id = request_id.get()
        # Nginx overwrites X-Real-IP. Only configured internal proxies are trusted.
        networks = os.getenv("TRUSTED_PROXY_NETWORKS", "").split(",")
        try:
            remote = ipaddress.ip_address(request.META.get("REMOTE_ADDR", ""))
            if any(remote in ipaddress.ip_network(n.strip()) for n in networks if n.strip()):
                request.META["REMOTE_ADDR"] = str(
                    ipaddress.ip_address(request.META.get("HTTP_X_REAL_IP", str(remote)))
                )
        except ValueError:
            pass
        try:
            response = self.get_response(request)
            response["X-Request-ID"] = request.request_id
            if request.path.startswith(
                ("/api/", "/kabinet", "/kirish", "/faollashtirish", "/parolni-tiklash")
            ):
                response["Cache-Control"] = "no-store, private"
            response["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
            logging.getLogger("yuksalish.request").info("%s %s", request.method, response.status_code)
            return response
        finally:
            request_id.reset(token)
