import io
from datetime import date

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from apps.accounts.models import User
from apps.audit.models import AuditEvent
from apps.content.models import Achievement
from apps.education.models import Enrollment, Subject
from apps.staff.models import TeacherProfile
from apps.students.models import Student

pytestmark = pytest.mark.django_db


def picture(color="teal"):
    buffer = io.BytesIO()
    Image.new("RGB", (120, 160), color).save(buffer, "PNG")
    return SimpleUploadedFile("certificate.png", buffer.getvalue(), content_type="image/png")


@pytest.fixture
def certificate_academy(academy, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    academy["teacher"].subjects.add(academy["subject"])
    Enrollment.objects.create(student=academy["student"], group=academy["group"], start_date=date(2026, 1, 1))
    return academy


def payload(academy, **kwargs):
    return {
        "student": academy["student"].pk,
        "display_name": "Sinov o‘quvchi",
        "title": "Milliy sertifikat",
        "description": "Faqat sinov ma’lumoti.",
        "subject": academy["subject"].pk,
        "score": "87 ball · A",
        "image": picture(),
        "publication_status": "DRAFT",
        **kwargs,
    }


def stranger_teacher():
    user = User.objects.create_user("+998939998877", roles=["TEACHER"])
    teacher = TeacherProfile.objects.create(user=user, full_name="Boshqa ustoz", slug="stranger")
    return user, teacher


def test_teacher_certificate_crud_private_preview_and_publication(certificate_academy, users, client_for):
    academy = certificate_academy
    client = client_for(users["TEACHER"])
    response = client.post("/api/v1/content/achievements/", payload(academy), format="multipart")
    assert response.status_code == 201, response.data
    obj = Achievement.objects.get(pk=response.data["id"])
    assert obj.student == academy["student"] and obj.teacher == academy["teacher"]
    listing = client.get(f"/api/v1/content/achievements/?student={obj.student_id}")
    assert listing.status_code == 200 and listing.data["count"] == 1
    assert listing.data["results"][0]["student_name"] == academy["student"].full_name
    preview = "/api/v1/content/image-preview/?path=" + obj.image.name
    assert client.get(preview).status_code == 200
    other_user, _ = stranger_teacher()
    assert client_for(other_user).get(preview).status_code == 404
    assert client_for().get(obj.image.url).status_code == 404
    path = f"/api/v1/content/achievements/{obj.pk}/"
    update = client.patch(path, {"score": "91 ball · A+", "image": picture("navy")}, format="multipart")
    assert update.status_code == 200, update.data
    assert update.data["score"] == "91 ball · A+" and update.data["image"] != response.data["image"]
    assert client.patch(path, {"publication_status": "PUBLISHED"}, format="json").status_code == 400
    assert (
        client.patch(
            path,
            {
                "publication_status": "PUBLISHED",
                "consent_record": "Sun’iy test roziligi",
                "privacy_reviewed": True,
            },
            format="json",
        ).status_code
        == 200
    )
    public = client_for().get("/api/v1/public/achievements/").data["results"][0]
    assert public["score"] == "91 ball · A+" and public["teacher_name"] == academy["teacher"].full_name
    assert "student" not in public and "student_name" not in public
    pk = obj.pk
    assert client.delete(path).status_code == 204
    assert not Achievement.objects.filter(pk=pk).exists()
    assert client_for().get(update.data["image"]).status_code == 404
    for action in ["record.created", "record.changed", "record.deleted"]:
        assert AuditEvent.objects.filter(
            entity_type="content.Achievement", entity_id=str(pk), action=action
        ).exists()


@pytest.mark.parametrize("role", ["OWNER_ADMIN", "ADMINISTRATOR"])
def test_office_can_manage_linked_certificates(certificate_academy, users, client_for, role):
    academy = certificate_academy
    client = client_for(users[role])
    response = client.post(
        "/api/v1/content/achievements/", payload(academy, teacher=academy["teacher"].pk), format="multipart"
    )
    assert response.status_code == 201, response.data
    path = f"/api/v1/content/achievements/{response.data['id']}/"
    assert client.patch(path, {"score": "92 ball"}, format="json").status_code == 200
    students = client.get("/api/v1/students/?has_certificate=true").data
    assert students["count"] == 1 and students["results"][0]["certificates"][0]["score"] == "92 ball"
    assert client.delete(path).status_code == 204
    assert client.get("/api/v1/students/?has_certificate=true").data["count"] == 0


def test_teacher_cannot_read_change_delete_others_or_forge_links(certificate_academy, users, client_for):
    academy = certificate_academy
    other_user, other = stranger_teacher()
    other.subjects.add(academy["subject"])
    own = client_for(users["TEACHER"])
    record = Achievement.objects.create(
        student=academy["student"],
        teacher=other,
        subject=academy["subject"],
        display_name="Test",
        title="Test",
        description="Test",
    )
    path = f"/api/v1/content/achievements/{record.pk}/"
    assert own.get("/api/v1/content/achievements/").data["count"] == 0
    for response in [
        own.get(path),
        own.patch(path, {"score": "X"}, format="json"),
        own.put(path, {}, format="json"),
        own.delete(path),
    ]:
        assert response.status_code == 404
    for changes in [
        {"student": academy["stranger"].pk},
        {"teacher": other.pk},
        {"student": ""},
    ]:
        assert (
            own.post(
                "/api/v1/content/achievements/", payload(academy, **changes), format="multipart"
            ).status_code
            == 400
        )
    foreign_subject = Subject.objects.create(name="Boshqa fan", slug="other")
    assert (
        own.post(
            "/api/v1/content/achievements/", payload(academy, subject=foreign_subject.pk), format="multipart"
        ).status_code
        == 400
    )
    assert client_for(other_user).get(path).status_code == 200


def test_certificate_subject_picker_is_scoped_without_opening_other_education_writes(
    certificate_academy, users, client_for
):
    academy = certificate_academy
    Subject.objects.create(name="Begona fan", slug="foreign")
    client = client_for(users["TEACHER"])
    response = client.get("/api/v1/content/achievements/subjects/?search=Matematika")
    assert response.status_code == 200 and response.data["count"] == 1
    assert response.data["results"][0]["id"] == academy["subject"].pk
    assert client.get("/api/v1/subjects/").status_code == 403
    assert client.post("/api/v1/students/", {}, format="json").status_code == 403
    assert client.post("/api/v1/content/settings/", {}, format="json").status_code == 403


def test_teacher_can_edit_own_historical_certificate_after_group_reassignment(
    certificate_academy, users, client_for
):
    academy = certificate_academy
    record = Achievement.objects.create(
        student=academy["student"],
        teacher=academy["teacher"],
        subject=academy["subject"],
        display_name="Test",
        title="Test",
        description="Test",
    )
    _, other = stranger_teacher()
    academy["group"].teacher = other
    academy["group"].save()
    academy["teacher"].subjects.clear()
    response = client_for(users["TEACHER"]).patch(
        f"/api/v1/content/achievements/{record.pk}/",
        {"student": academy["student"].pk, "subject": academy["subject"].pk, "score": "Tuzatildi"},
        format="json",
    )
    assert response.status_code == 200, response.data


def test_sample_unlinked_and_imageless_results_do_not_count_as_student_certificates(
    certificate_academy, users, client_for
):
    academy = certificate_academy
    client = client_for(users["ADMINISTRATOR"])
    for changes in [{"is_sample": True}, {"student": ""}]:
        data = payload(academy, **changes)
        response = client.post("/api/v1/content/achievements/", data, format="multipart")
        assert response.status_code == 201, response.data
    Achievement.objects.create(
        student=academy["student"],
        subject=academy["subject"],
        display_name="Test",
        title="Rasmsiz",
        description="Test",
    )
    assert client.get("/api/v1/students/?has_certificate=true").data["count"] == 0
    assert client.get("/api/v1/students/?has_certificate=false").data["count"] == 2
    response = client.post("/api/v1/content/achievements/", payload(academy), format="multipart")
    assert response.status_code == 201
    listing = client.get("/api/v1/students/?has_certificate=true").data
    assert listing["count"] == listing["results"][0]["certificate_count"] == 1
    assert listing["results"][0]["certificates"][0]["title"] == "Milliy sertifikat"
    assert client.get("/api/v1/students/?has_certificate=false").data["count"] == 1
    assert client.get("/api/v1/students/?certificate_subject=999999").data["count"] == 0
    assert client.get("/api/v1/students/?has_certificate=invalid").status_code == 400


def test_teacher_student_filter_and_summary_do_not_leak_other_teacher_results(
    certificate_academy, users, client_for
):
    academy = certificate_academy
    owner = client_for(users["OWNER_ADMIN"])
    _, other = stranger_teacher()
    other.subjects.add(academy["subject"])
    owner.post(
        "/api/v1/content/achievements/",
        payload(academy, teacher=other.pk, title="Begona natija"),
        format="multipart",
    )
    teacher = client_for(users["TEACHER"])
    assert teacher.get("/api/v1/students/?has_certificate=true").data["count"] == 0
    own = teacher.post("/api/v1/content/achievements/", payload(academy), format="multipart")
    assert own.status_code == 201
    result = teacher.get("/api/v1/students/?has_certificate=true").data
    assert result["count"] == 1
    assert result["results"][0]["certificate_count"] == 1
    assert result["results"][0]["certificates"][0]["title"] == "Milliy sertifikat"
    assert owner.get("/api/v1/students/?has_certificate=true").data["results"][0]["certificate_count"] == 2
    assert "internal_notes" not in result["results"][0]


@pytest.mark.parametrize("role", ["ACCOUNTANT", "STUDENT", "PARENT"])
def test_certificate_management_and_filters_remain_private(certificate_academy, users, client_for, role):
    client = client_for(users[role])
    assert client.get("/api/v1/content/achievements/").status_code == 403
    assert client.post("/api/v1/content/achievements/", {}, format="json").status_code == 403
    assert client.get("/api/v1/students/?has_certificate=true").status_code == 403
    assert client.get("/api/v1/students/?certificate_subject=1").status_code == 403
    for student in client.get("/api/v1/students/").data["results"]:
        assert "certificates" not in student and "certificate_count" not in student


def test_student_certificate_listing_has_bounded_queries(
    certificate_academy, users, client_for, django_assert_max_num_queries
):
    academy = certificate_academy
    for index in range(20):
        student = Student.objects.create(full_name=f"Sertifikat {index}", registered_on=date(2026, 1, 1))
        Achievement.objects.create(
            student=student,
            subject=academy["subject"],
            title="Milliy",
            display_name="Test",
            description="Test",
            score="85",
            image="achievements/test.jpg",
        )
    with django_assert_max_num_queries(4):
        response = client_for(users["OWNER_ADMIN"]).get("/api/v1/students/?has_certificate=true")
        assert response.status_code == 200 and response.data["count"] == 20
        assert all(row["certificate_count"] == 1 for row in response.data["results"])
