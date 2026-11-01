from common.middleware import request_id
from .models import AuditEvent

BLOCKED = {"password", "code", "code_hash", "token", "session", "session_key", "secret"}


def safe_values(values):
    return {str(k): v for k, v in (values or {}).items() if not any(x in str(k).lower() for x in BLOCKED)}


def audit(actor, action, entity, *, before=None, after=None, reason=""):
    return AuditEvent.objects.create(
        actor=actor if actor and actor.is_authenticated else None,
        action=action,
        entity_type=entity._meta.label,
        entity_id=str(entity.pk),
        before=safe_values(before),
        after=safe_values(after),
        reason=reason,
        request_id=request_id.get(),
    )
