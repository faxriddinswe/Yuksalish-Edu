import io
import json

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from PIL import Image

from apps.content.models import Achievement

pytestmark = pytest.mark.django_db


def prepare(root, **kwargs):
    call_command("sync_certificates", root=root, init=True, stdout=io.StringIO())
    path = root / "math" / "certificates.json"
    manifest = json.loads(path.read_text())
    manifest["certificates"][0].update(
        {
            "display_name": "Sinov o‘quvchisi",
            "title": "Sinov sertifikati",
            "description": "Haqiqiy yutuq emas.",
            "publish": True,
            "privacy_reviewed": True,
            "consent_record": "Sun’iy test yozuvi",
            **kwargs,
        }
    )
    path.write_text(json.dumps(manifest))
    Image.new("RGB", (120, 180), "teal").save(root / "math" / "01.jpg")
    return path, manifest


def test_init_creates_ten_slots_without_overwriting(academy, tmp_path):
    path, manifest = prepare(tmp_path)
    call_command("sync_certificates", root=tmp_path, init=True, stdout=io.StringIO())
    assert json.loads(path.read_text()) == manifest
    assert [row["slot"] for row in manifest["certificates"]] == list(range(1, 11))
    assert not Achievement.objects.exists()


def test_import_dry_run_idempotent_update_and_private_unpublish(academy, tmp_path, settings, client_for):
    settings.MEDIA_ROOT = tmp_path / "media"
    path, manifest = prepare(tmp_path)
    call_command("sync_certificates", root=tmp_path, dry_run=True, stdout=io.StringIO())
    assert not Achievement.objects.exists() and not settings.MEDIA_ROOT.exists()
    call_command("sync_certificates", root=tmp_path, stdout=io.StringIO())
    obj = Achievement.objects.get(import_key="math/01")
    original = obj.image.name
    public = client_for()
    assert public.get("/api/v1/public/achievements/").data["count"] == 1
    call_command("sync_certificates", root=tmp_path, stdout=io.StringIO())
    obj.refresh_from_db()
    assert Achievement.objects.count() == 1 and obj.image.name == original
    manifest["certificates"][0].update(title="Yangilangan", publish=False)
    path.write_text(json.dumps(manifest))
    call_command("sync_certificates", root=tmp_path, stdout=io.StringIO())
    obj.refresh_from_db()
    assert obj.pk and obj.title == "Yangilangan" and Achievement.objects.count() == 1
    assert public.get("/api/v1/public/achievements/").data["count"] == 0
    assert public.get(obj.image.url).status_code == 404


@pytest.mark.parametrize(
    "change",
    [
        {"privacy_reviewed": False},
        {"consent_record": ""},
        {"slot": 41},
        {"file": "../../private.jpg"},
        {"publish": "false"},
        {"display_name": ""},
    ],
)
def test_invalid_import_never_partially_saves(academy, tmp_path, settings, change):
    settings.MEDIA_ROOT = tmp_path / "media"
    prepare(tmp_path, **change)
    with pytest.raises(CommandError):
        call_command("sync_certificates", root=tmp_path, stdout=io.StringIO())
    assert not Achievement.objects.exists()


def test_ten_certificates_and_more_remain_accessible_in_public_api(academy, tmp_path, settings, client_for):
    settings.MEDIA_ROOT = tmp_path / "media"
    path, manifest = prepare(tmp_path)
    for row in manifest["certificates"]:
        row.update(manifest["certificates"][0], slot=row["slot"], file=f"{row['slot']:02}.jpg")
        Image.new("RGB", (120, 180), "teal").save(path.parent / row["file"])
    path.write_text(json.dumps(manifest))
    call_command("sync_certificates", root=tmp_path, stdout=io.StringIO())
    assert Achievement.objects.count() == 10
    client = client_for()
    data = client.get(
        "/api/v1/public/achievements/", {"subject": academy["subject"].pk, "page_size": 10}
    ).data
    assert data["count"] == len(data["results"]) == 10


def test_forty_sample_cards_share_one_image_and_preserve_score(academy, tmp_path, settings, client_for):
    settings.MEDIA_ROOT = tmp_path / "media"
    path, manifest = prepare(tmp_path)
    template = {**manifest["certificates"][0], "score": "57 ball · B2", "is_sample": True}
    manifest["certificates"] = [{**template, "slot": slot} for slot in range(1, 41)]
    path.write_text(json.dumps(manifest))
    call_command("sync_certificates", root=tmp_path, stdout=io.StringIO())
    assert Achievement.objects.count() == 40
    assert Achievement.objects.values("image").distinct().count() == 1
    assert len(list(settings.MEDIA_ROOT.rglob("*.jpg"))) == 1
    public = client_for()
    data = public.get(
        "/api/v1/public/achievements/", {"subject": academy["subject"].pk, "page_size": 40}
    ).data
    assert data["count"] == len(data["results"]) == 40
    assert all(row["score"] == "57 ball · B2" and row["is_sample"] for row in data["results"])
    call_command("sync_certificates", root=tmp_path, stdout=io.StringIO())
    assert Achievement.objects.count() == 40
    assert len(list(settings.MEDIA_ROOT.rglob("*.jpg"))) == 1
