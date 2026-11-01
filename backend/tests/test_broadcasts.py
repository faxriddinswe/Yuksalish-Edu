from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from uuid import uuid4

import pytest
from django.db import close_old_connections
from apps.accounts.models import User
from apps.notifications.models import Broadcast, Notification
from apps.notifications.services import broadcast_message
from apps.audit.models import AuditEvent

pytestmark = pytest.mark.django_db


def test_admin_broadcast_visible_to_every_role_and_independent_reads(users, client_for):
    admin = client_for(users["ADMINISTRATOR"])
    response = admin.post(
        "/api/v1/notifications/broadcast/",
        {"title": "Yangi jadval", "message": "Dushanba kuni\nDarslar odatdagidek."},
        format="json",
        HTTP_IDEMPOTENCY_KEY=str(uuid4()),
    )
    assert response.status_code == 201, response.data
    assert response.data["recipient_count"] == 6
    assert Notification.objects.filter(broadcast_id=response.data["id"]).count() == 6
    for role, user in users.items():
        client = client_for(user)
        rows = client.get("/api/v1/notifications/").data
        assert rows["count"] == 1 and rows["results"][0]["title"] == "Yangi jadval", role
        assert client.get("/api/v1/notifications/unread-count/").data["unread_count"] == 1
    student = client_for(users["STUDENT"])
    own = Notification.objects.get(recipient=users["STUDENT"])
    foreign = Notification.objects.get(recipient=users["TEACHER"])
    assert student.post(f"/api/v1/notifications/{foreign.pk}/read/").status_code == 404
    assert student.post(f"/api/v1/notifications/{own.pk}/read/").status_code == 200
    assert student.get("/api/v1/notifications/unread-count/").data["unread_count"] == 0
    assert student.get("/api/v1/notifications/?unread=true").data["count"] == 0
    assert client_for(users["PARENT"]).get("/api/v1/notifications/unread-count/").data["unread_count"] == 1
    assert AuditEvent.objects.filter(action="notification.broadcasted", actor=users["ADMINISTRATOR"]).exists()
    history = admin.get("/api/v1/notifications/broadcasts/").data
    assert history["count"] == 1 and history["results"][0]["sender_name"] == users["ADMINISTRATOR"].full_name


@pytest.mark.parametrize("role", ["STUDENT", "PARENT", "TEACHER", "ACCOUNTANT"])
def test_broadcast_permissions(users, client_for, role):
    client = client_for(users[role])
    for path in ["broadcast/", "broadcasts/"]:
        assert client.get("/api/v1/notifications/" + path).status_code == 403
    assert (
        client.post(
            "/api/v1/notifications/broadcast/",
            {"title": "X", "message": "Y"},
            format="json",
            HTTP_IDEMPOTENCY_KEY=str(uuid4()),
        ).status_code
        == 403
    )
    assert not Broadcast.objects.exists()


def test_idempotency_validation_and_inactive_audience(users, client_for):
    inactive = users["TEACHER"]
    inactive.is_active = False
    inactive.save()
    client = client_for(users["OWNER_ADMIN"])
    assert client.get("/api/v1/notifications/broadcast/").data["recipient_count"] == 5
    data = {"title": "Markaz e’loni", "message": "Yangi xabar"}
    key = str(uuid4())
    assert client.post("/api/v1/notifications/broadcast/", data, format="json").status_code == 400
    assert (
        client.post(
            "/api/v1/notifications/broadcast/",
            {**data, "title": " "},
            format="json",
            HTTP_IDEMPOTENCY_KEY=key,
        ).status_code
        == 400
    )
    assert (
        client.post(
            "/api/v1/notifications/broadcast/",
            {**data, "message": "x" * 5001},
            format="json",
            HTTP_IDEMPOTENCY_KEY=key,
        ).status_code
        == 400
    )
    assert (
        client.post(
            "/api/v1/notifications/broadcast/", data, format="json", HTTP_IDEMPOTENCY_KEY=key
        ).status_code
        == 201
    )
    assert (
        client.post(
            "/api/v1/notifications/broadcast/", data, format="json", HTTP_IDEMPOTENCY_KEY=key
        ).status_code
        == 200
    )
    assert (
        client.post(
            "/api/v1/notifications/broadcast/",
            {**data, "message": "Boshqa xabar"},
            format="json",
            HTTP_IDEMPOTENCY_KEY=key,
        ).status_code
        == 400
    )
    assert (
        client_for(users["ADMINISTRATOR"])
        .post("/api/v1/notifications/broadcast/", data, format="json", HTTP_IDEMPOTENCY_KEY=key)
        .status_code
        == 400
    )
    assert Broadcast.objects.count() == 1 and Notification.objects.count() == 5
    assert not Notification.objects.filter(recipient=inactive).exists()
    assert client.patch("/api/v1/notifications/broadcasts/1/", data, format="json").status_code in [404, 405]
    assert client_for().get("/api/v1/notifications/unread-count/").status_code == 403


def test_broadcast_rolls_back_on_audit_failure(users, monkeypatch):
    def fail(*args, **kwargs):
        raise RuntimeError("Storage failure")

    monkeypatch.setattr("apps.audit.services.audit", fail)
    with pytest.raises(RuntimeError):
        broadcast_message(users["ADMINISTRATOR"], "Sinov", "Qayta tekshirish", uuid4())
    assert not Broadcast.objects.exists() and not Notification.objects.exists()


@pytest.mark.django_db(transaction=True)
def test_parallel_broadcast_retry_does_not_duplicate(users):
    barrier = Barrier(2)
    actor_id = users["ADMINISTRATOR"].pk
    key = uuid4()

    def worker(_):
        close_old_connections()
        try:
            actor = User.objects.get(pk=actor_id)
            barrier.wait(timeout=10)
            obj, created = broadcast_message(actor, "Sinov", "Parallel qayta so‘rov", key)
            return obj.pk, created
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(worker, range(2)))
    assert results[0][0] == results[1][0]
    assert sorted(result[1] for result in results) == [False, True]
    assert Broadcast.objects.count() == 1 and Notification.objects.count() == 6
