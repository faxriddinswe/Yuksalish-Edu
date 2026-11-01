import io
from datetime import date
import pytest
from PIL import Image
from django.core.files.uploadedfile import SimpleUploadedFile
from apps.content.models import Achievement, SiteSettings
from apps.education.models import Enrollment, Subject

pytestmark = pytest.mark.django_db


def picture():
    buffer = io.BytesIO()
    Image.new("RGB", (128, 96), "teal").save(buffer, "PNG")
    return SimpleUploadedFile("test.png", buffer.getvalue(), content_type="image/png")


def test_certificate_upload_filter_and_private_preview(academy, users, client_for, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    teacher = academy["teacher"]
    teacher.subjects.add(academy["subject"])
    owner = client_for(users["OWNER_ADMIN"])
    data = dict(
        display_name="Sinov O‘quvchi",
        title="Til sertifikati",
        description="Sinov yozuvi",
        subject=academy["subject"].pk,
        teacher=teacher.pk,
        achieved_on="2026-10-01",
        image=picture(),
    )
    response = owner.post("/api/v1/content/achievements/", data, format="multipart")
    assert response.status_code == 201, response.data
    pk = response.data["id"]
    image = response.data["image"]
    preview = "/api/v1/content/image-preview/?path=" + image.removeprefix("/media/")
    anonymous = client_for()
    assert anonymous.get(image).status_code == 404
    assert anonymous.get(preview).status_code == 403
    assert client_for(users["STUDENT"]).get(preview).status_code == 403
    private = owner.get(preview)
    assert private.status_code == 200 and "no-store" in private["Cache-Control"]
    assert b"".join(private.streaming_content)
    assert anonymous.get("/api/v1/public/achievements/").data["count"] == 0
    update = owner.patch(
        f"/api/v1/content/achievements/{pk}/",
        dict(publication_status="PUBLISHED", privacy_reviewed=True, consent_record="Sinov roziligi"),
        format="json",
    )
    assert update.status_code == 200, update.data
    assert update.data["image"] == image
    listing = anonymous.get(f"/api/v1/public/achievements/?subject={academy['subject'].pk}").data
    assert listing["count"] == 1
    assert listing["results"][0]["teacher_name"] == teacher.full_name
    assert listing["results"][0]["subject_name"] == academy["subject"].name
    other = Subject.objects.create(name="Ona tili", slug="native")
    assert anonymous.get(f"/api/v1/public/achievements/?subject={other.pk}").data["count"] == 0
    mismatch = owner.patch(f"/api/v1/content/achievements/{pk}/", {"subject": other.pk}, format="json")
    assert mismatch.status_code == 400
    assert anonymous.get(image).status_code == 200
    assert owner.get("/api/v1/content/image-preview/?path=../../.env.local").status_code == 404
    # A published certificate cannot lose its image silently.
    assert owner.patch(f"/api/v1/content/achievements/{pk}/", {"image": ""}, format="json").status_code == 400
    assert Achievement.objects.get(pk=pk).image
    assert (
        owner.patch(
            f"/api/v1/content/achievements/{pk}/", {"publication_status": "DRAFT"}, format="json"
        ).status_code
        == 200
    )
    assert anonymous.get(image).status_code == 404


def test_center_images_validation_preservation_and_clear(users, client_for, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    obj = SiteSettings.objects.create()
    owner = client_for(users["OWNER_ADMIN"])
    url = f"/api/v1/content/settings/{obj.pk}/"
    response = owner.patch(url, {"cover_image": picture(), "mission": "Bilim sari"}, format="multipart")
    assert response.status_code == 200, response.data
    image = response.data["cover_image"]
    assert image.startswith("/media/center/") and image.endswith(".jpg")
    response = owner.patch(url, {"about": "Markaz haqida"}, format="json")
    assert response.data["cover_image"] == image
    assert client_for().get("/api/v1/public/settings/").data["cover_image"] == image
    assert (
        client_for(users["ADMINISTRATOR"]).patch(url, {"about": "Almashtirish"}, format="json").status_code
        == 200
    )
    bad = SimpleUploadedFile("evil.svg", b'<svg onload="alert(1)"/>', content_type="image/svg+xml")
    assert owner.patch(url, {"cover_image": bad}, format="multipart").status_code == 400
    assert owner.patch(url, {"cover_image": ""}, format="json").status_code == 200
    obj.refresh_from_db()
    assert not obj.cover_image


def test_teacher_distinct_count_and_approved_lifetime(academy, client_for):
    teacher = academy["teacher"]
    teacher.publication_status = "PUBLISHED"
    teacher.experience_years = 6
    teacher.save()
    teacher.subjects.add(academy["subject"])
    Enrollment.objects.create(
        student=academy["student"],
        group=academy["group"],
        start_date=date(2026, 1, 1),
        end_date=date(2026, 2, 1),
        status="ENDED",
    )
    Enrollment.objects.create(student=academy["student"], group=academy["group"], start_date=date(2026, 3, 1))
    url = f"/api/v1/public/teachers/{teacher.slug}/"
    data = client_for().get(url).data
    assert data["student_count"] == 1 and data["experience_years"] == 6
    assert data["subject_names"] == [academy["subject"].name]
    teacher.students_taught = 150
    teacher.save()
    assert client_for().get(url).data["student_count"] == 150


def test_student_invitation_permissions(academy, users, client_for):
    url = f"/api/v1/students/{academy['student'].pk}/invitation/"
    for role in ["STUDENT", "PARENT", "TEACHER", "ACCOUNTANT"]:
        assert client_for(users[role]).post(url, {"purpose": "RESET"}, format="json").status_code == 403
    response = client_for(users["ADMINISTRATOR"]).post(url, {"purpose": "RESET"}, format="json")
    assert response.status_code == 200 and response.data["expires_in_hours"] == 24
    assert response.data["code"]


@pytest.mark.parametrize("kind", ["dimensions", "size"])
def test_image_limits(users, client_for, settings, tmp_path, kind):
    settings.MEDIA_ROOT = tmp_path
    obj = SiteSettings.objects.create()
    buffer = io.BytesIO()
    Image.new("RGB", (5001, 20) if kind == "dimensions" else (64, 64)).save(buffer, "PNG")
    raw = buffer.getvalue() + (b"0" * (5 * 1024 * 1024) if kind == "size" else b"")
    image = SimpleUploadedFile("limit.png", raw, content_type="image/png")
    response = client_for(users["OWNER_ADMIN"]).patch(
        f"/api/v1/content/settings/{obj.pk}/", {"cover_image": image}, format="multipart"
    )
    assert response.status_code == 400
    obj.refresh_from_db()
    assert not obj.cover_image


def test_teacher_draft_photo_preview_is_scoped(academy, users, client_for, settings, tmp_path):
    from apps.accounts.models import User
    from apps.staff.models import TeacherProfile

    settings.MEDIA_ROOT = tmp_path
    owner = client_for(users["OWNER_ADMIN"])
    teacher = academy["teacher"]
    response = owner.patch(f"/api/v1/staff/teachers/{teacher.pk}/", {"photo": picture()}, format="multipart")
    assert response.status_code == 200
    path = response.data["photo"].removeprefix("/media/")
    preview = "/api/v1/content/image-preview/?path=" + path
    assert client_for(users["TEACHER"]).get(preview).status_code == 200
    stranger = User.objects.create_user("+998907777777", roles=["TEACHER"])
    TeacherProfile.objects.create(user=stranger, full_name="Boshqa ustoz", slug="other-teacher")
    assert client_for(stranger).get(preview).status_code == 404
    assert client_for().get(response.data["photo"]).status_code == 404
