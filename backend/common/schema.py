"""OpenAPI javob turlari; maxfiy namunaviy qiymatlar kiritilmaydi."""

MESSAGE = {"type": "object", "properties": {"message": {"type": "string"}}}
USER = {
    "type": "object",
    "properties": {
        "id": {"type": "integer"},
        "phone": {"type": "string"},
        "full_name": {"type": "string"},
        "roles": {"type": "array", "items": {"type": "string"}},
        "extra_permissions": {"type": "array", "items": {"type": "string"}},
        "is_active": {"type": "boolean"},
    },
}
SESSION = {
    "type": "object",
    "properties": {"csrfToken": {"type": "string"}, "user": {**USER, "nullable": True}},
}


def object_schema(**fields):
    return {"type": "object", "properties": {name: {"type": kind} for name, kind in fields.items()}}
