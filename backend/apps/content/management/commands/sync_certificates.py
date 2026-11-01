import hashlib
import json
from pathlib import Path

from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.audit.services import audit
from apps.content.models import Achievement
from apps.content.views import AchievementSerializer
from apps.education.models import Subject
from apps.staff.models import TeacherProfile


class Command(BaseCommand):
    help = "Fan papkalaridagi 01–40 sertifikatni mavjud natijalar bazasiga takrorsiz kiriting."

    def add_arguments(self, parser):
        parser.add_argument("--root", type=Path, default=settings.BASE_DIR.parent / "certificates")
        parser.add_argument(
            "--init", action="store_true", help="Har bir faol fan uchun 10 ta bo‘sh joy tayyorlash"
        )
        parser.add_argument("--dry-run", action="store_true", help="Tekshirish; bazaga yozmaslik")

    def handle(self, *args, **options):
        root = options["root"].resolve()
        subjects = list(Subject.objects.filter(is_active=True).order_by("name"))
        if options["init"]:
            if options["dry_run"]:
                raise CommandError("--init va --dry-run alohida ishlatiladi.")
            for subject in subjects:
                folder = root / subject.slug
                folder.mkdir(parents=True, exist_ok=True)
                manifest = folder / "certificates.json"
                if not manifest.exists():
                    template = {
                        "subject": subject.slug,
                        "certificates": [
                            {
                                "slot": slot,
                                "file": f"{slot:02}.jpg",
                                "display_name": "",
                                "title": "",
                                "description": "",
                                "achieved_on": None,
                                "teacher_slug": "",
                                "publish": False,
                                "consent_record": "",
                                "privacy_reviewed": False,
                            }
                            for slot in range(1, 11)
                        ],
                    }
                    manifest.write_text(json.dumps(template, ensure_ascii=False, indent=2) + "\n")
            self.stdout.write(f"{len(subjects)} ta fan uchun 10 tadan joy tayyor. Mavjud fayllar saqlandi.")
            return

        prepared = []
        pending = unchanged = 0
        for subject in subjects:
            folder = (root / subject.slug).resolve()
            if not folder.is_relative_to(root):
                raise CommandError("Fan papkasi asosiy papka ichida bo‘lishi kerak.")
            manifest = folder / "certificates.json"
            if not manifest.exists():
                continue
            if not manifest.resolve().is_relative_to(root):
                raise CommandError("Ma’lumot fayli asosiy papka ichida bo‘lishi kerak.")
            try:
                data = json.loads(manifest.read_text())
                if not isinstance(data, dict) or data.get("subject") != subject.slug:
                    raise ValueError("subject fan papkasi nomiga mos bo‘lsin")
                entries = data["certificates"]
                if not isinstance(entries, list) or len(entries) > 40:
                    raise ValueError("bir fan uchun ko‘pi bilan 40 ta yozuv")
                slots = set()
                for entry in entries:
                    slot = entry["slot"]
                    if type(slot) is not int or not 1 <= slot <= 40 or slot in slots:
                        raise ValueError("slot 1–40 oralig‘ida va takrorlanmagan bo‘lsin")
                    slots.add(slot)
                    filename = entry["file"]
                    if not isinstance(filename, str) or Path(filename).name != filename:
                        raise ValueError("file faqat shu papkadagi rasm nomi bo‘lsin")
                    image = (folder / filename).resolve()
                    if not image.is_relative_to(folder):
                        raise ValueError("rasm fan papkasidan tashqarida")
                    if not image.is_file():
                        pending += 1
                        continue
                    if image.stat().st_size > 5 * 1024 * 1024:
                        raise ValueError(f"{filename}: rasm 5 MB dan oshmasin")
                    if (
                        type(entry.get("publish", False)) is not bool
                        or type(entry.get("privacy_reviewed", False)) is not bool
                        or type(entry.get("is_sample", False)) is not bool
                    ):
                        raise ValueError("publish, privacy_reviewed va is_sample true/false bo‘lsin")
                    if entry.get("publish") and (
                        not entry.get("privacy_reviewed") or not str(entry.get("consent_record", "")).strip()
                    ):
                        raise ValueError("E’lon qilish uchun rozilik qaydi va privacy_reviewed: true kerak")
                    picture = image.read_bytes()
                    digest = hashlib.sha256(json.dumps(entry, sort_keys=True).encode() + picture).hexdigest()
                    key = f"{subject.slug}/{slot:02}"
                    existing = Achievement.objects.filter(import_key=key).first()
                    # Fingerprint is stored in the import audit, not exposed publicly.
                    if existing and existing.image and existing.image.storage.exists(existing.image.name):
                        from apps.audit.models import AuditEvent

                        last = (
                            AuditEvent.objects.filter(
                                entity_type="content.Achievement",
                                entity_id=str(existing.pk),
                                action="certificate.imported",
                            )
                            .order_by("-id")
                            .first()
                        )
                        if (
                            last
                            and last.after.get("source_digest") == digest
                            and last.occurred_at >= existing.updated_at
                        ):
                            unchanged += 1
                            continue
                    teacher = None
                    if entry.get("teacher_slug"):
                        teacher = TeacherProfile.objects.get(slug=entry["teacher_slug"])
                    serializer = AchievementSerializer(
                        instance=existing,
                        data={
                            "subject": subject.pk,
                            "display_name": entry.get("display_name", ""),
                            "title": entry.get("title", ""),
                            "description": entry.get("description", ""),
                            "score": entry.get("score", ""),
                            "is_sample": entry.get("is_sample", False),
                            "achieved_on": entry.get("achieved_on") or None,
                            "teacher": teacher.pk if teacher else None,
                            "image": SimpleUploadedFile(filename, picture, content_type="image/jpeg"),
                            "publication_status": "PUBLISHED" if entry.get("publish", False) else "DRAFT",
                            "consent_record": entry.get("consent_record", ""),
                            "privacy_reviewed": entry.get("privacy_reviewed", False),
                        },
                    )
                    serializer.is_valid(raise_exception=True)
                    prepared.append((serializer, key, digest, hashlib.sha256(picture).hexdigest()))
            except (
                OSError,
                ValueError,
                KeyError,
                TypeError,
                ValidationError,
                TeacherProfile.DoesNotExist,
            ) as error:
                raise CommandError(f"{manifest}: {error}") from error

        created = updated = 0
        written = []
        shared_images = {}
        try:
            with transaction.atomic():
                for serializer, key, digest, image_digest in prepared:
                    if options["dry_run"]:
                        continue
                    is_new = serializer.instance is None
                    if image_digest in shared_images:
                        obj = serializer.save(import_key=key, image=shared_images[image_digest])
                    else:
                        obj = serializer.save(import_key=key)
                        shared_images[image_digest] = obj.image.name
                        written.append((obj.image.storage, obj.image.name))
                    obj.full_clean()
                    audit(None, "certificate.imported", obj, after={"source": key, "source_digest": digest})
                    created += is_new
                    updated += not is_new
        except Exception:
            for storage, name in written:
                storage.delete(name)
            raise
        if options["dry_run"]:
            self.stdout.write(
                f"Tekshirildi: {len(prepared)} ta tayyor, {unchanged} ta o‘zgarmagan, {pending} ta rasm kutilmoqda. Bazaga yozilmadi."
            )
        else:
            self.stdout.write(
                f"Yangi: {created}, yangilandi: {updated}, o‘zgarmagan: {unchanged}, rasm kutilmoqda: {pending}."
            )
