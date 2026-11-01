import io
import uuid
from PIL import Image, UnidentifiedImageError
from django.core.files.base import ContentFile
from rest_framework import serializers
from django.db import models
from apps.accounts.models import normalize_phone


class ClearableImageField(serializers.ImageField):
    def to_internal_value(self, data):
        # Explicit empty string clears an optional image; omission preserves it.
        if data == "" and not self.required:
            return ""
        return super().to_internal_value(data)


class SafeModelSerializer(serializers.ModelSerializer):
    serializer_field_mapping = {
        **serializers.ModelSerializer.serializer_field_mapping,
        models.ImageField: ClearableImageField,
    }

    def to_representation(self, instance):
        from urllib.parse import urlsplit

        data = super().to_representation(instance)
        for key in ["image", "photo", "cover_image", "about_image"]:
            if data.get(key):
                data[key] = urlsplit(data[key]).path
        return data

    def validate(self, attrs):
        for field, value in attrs.items():
            if isinstance(value, str) and ("<script" in value.lower() or "<iframe" in value.lower()):
                raise serializers.ValidationError(
                    {field: "Oddiy matndan foydalaning. HTML skript qabul qilinmaydi."}
                )
            if field in ["phone", "contact_phone", "public_phone"] and value:
                attrs[field] = normalize_phone(value)
            if hasattr(value, "content_type") and field in ["photo", "image", "cover_image", "about_image"]:
                if value.size > 5 * 1024 * 1024:
                    raise serializers.ValidationError({field: "Rasm hajmi 5 MB dan oshmasin."})
                try:
                    picture = Image.open(value)
                    if (
                        picture.format not in ["JPEG", "PNG", "WEBP"]
                        or max(picture.size) > 5000
                        or min(picture.size) < 16
                    ):
                        raise ValueError
                    picture.load()
                    picture.thumbnail((1800, 1800))
                    buffer = io.BytesIO()
                    picture.convert("RGB").save(buffer, format="JPEG", quality=88)
                    attrs[field] = ContentFile(buffer.getvalue(), name=f"{uuid.uuid4().hex}.jpg")
                except (UnidentifiedImageError, ValueError, OSError, Image.DecompressionBombError):
                    raise serializers.ValidationError(
                        {field: "Faqat haqiqiy JPEG, PNG yoki WebP rasm yuboring; o‘lchami 5000px gacha."}
                    )
        return attrs


def serializer_for(model, fields, readonly=(), name=None):
    meta = type(
        "Meta",
        (),
        {
            "model": model,
            "fields": ["id", *fields, "created_at", "updated_at"],
            "read_only_fields": ["id", "created_at", "updated_at", *readonly],
        },
    )
    return type(name or f"{model.__name__}Serializer", (SafeModelSerializer,), {"Meta": meta})
