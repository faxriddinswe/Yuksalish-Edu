# Lokal ishlab chiqish

## Tavsiya: Docker Compose

Python/Node’ni hostga o‘rnatish shart emas. Docker Engine va Compose v2 kerak. Port 8080 bo‘sh bo‘lsin.

```bash
python3 scripts/init-env
docker compose build
docker compose up -d
# migrate bir martalik xizmat avtomatik ishlaydi; qo‘lda qayta bajarish:
docker compose run --rm migrate
# Mahsulot rahbari:
docker compose exec backend python manage.py create_owner --phone +998XXXXXXXXX --name "Rahbar ismi"
# Ichki texnik admin, ixtiyoriy:
docker compose exec backend python manage.py createsuperuser
# Faqat sun’iy lokal demo:
docker compose exec backend python manage.py seed_demo --students 100
```

Sayt: http://localhost:8080. Rahbarni Django superuser bilan adashtirmang. `create_owner` parolni ekranga chiqarmasdan so‘raydi. `.env` dagi DEMO_PASSWORD faqat demo akkauntlar uchun; gitga kiritilmaydi.

```bash
docker compose logs -f backend celery-worker celery-beat
docker compose exec backend pytest
docker compose exec frontend npm run typecheck
docker compose exec frontend npm run test
docker compose down
```

`down -v` biznes ma’lumotlari volume’larini o‘chiradi; kundalik to‘xtatishda ishlatmang.

## Docker’siz ishlab chiqish

Python 3.14 (3.12/3.13 uchun mos wheel lockini qayta tekshiring), Node 22, PostgreSQL 15+ va Redis 8. `backend/requirements.lock` pip orqali aniq versiyalar; frontend faqat npm/package-lock.

```bash
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.lock
npm ci --prefix frontend
```

`.env.local` faylini 0600 ruxsat bilan yarating. Zarur qiymatlar: DJANGO_SECRET_KEY (tasodifiy, kamida 50 belgi), POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_HOST, POSTGRES_PORT, REDIS_URL, DJANGO_SETTINGS_MODULE=config.settings.local, DEMO_PASSWORD (demo ishlatilsa). Scriptlar shell orqali source qilmaydi, key=value sifatida o‘qiydi. Muhitdagi qiymatlar fayldan ustun.

PostgreSQL/Redis xizmatlarini ishga tushiring. Hozirgi ish muhitida PostgreSQL 55432 va Redis 56379 faqat localhost’da ishlatildi. Yangi kompyuterda o‘z xizmat portlaringizni yozing.

```bash
scripts/backend migrate
scripts/backend create_owner --phone +998XXXXXXXXX --name "Rahbar ismi"
scripts/backend seed_demo --students 100
# Alohida terminallarda:
scripts/backend runserver 127.0.0.1:8000
scripts/celery worker --loglevel=INFO --concurrency=2
scripts/celery beat --loglevel=INFO --schedule=/tmp/yuksalish-beat
cd frontend
npm run dev
```

Development server o‘rniga tayyor optimallashtirilgan build’ni lokal tekshirish uchun:

```bash
npm run build --prefix frontend
npm run start --prefix frontend
```

`start` standalone server va uning statik fayllarini tayyorlab, localhost:3000 da ochadi. Boshqa lokal port uchun `PORT`, interfeys uchun `FRONTEND_HOST` muhit o‘zgaruvchisi ishlatiladi. Docker production tasviri o‘z standalone kirish nuqtasidan foydalanadi.

Sayt http://localhost:3000. Next API/media’ni Django 8000 ga proxy qiladi. `API_INTERNAL_URL` bilan o‘zgartirish mumkin. TLS/sertifikat tekshiruvi o‘chirilmagan. Bu muhitda Turbopack yordamchi porti bloklangani uchun stable Webpack builder ishlatiladi. Tashqi Google Fonts so‘rovi kerak emas.

## Demo akkauntlar

| Rol | Telefon |
|---|---|
| Rahbar | +998900000001 |
| Administrator | +998900000002 |
| Buxgalter | +998900000003 |
| O‘quvchi | +998900000004 |
| Ota-ona | +998900000005 |
| Birinchi ustoz | +998901000000 |

Parol `DEMO_PASSWORD` muhit qiymati. Kod yoki hujjatda parol hardcode qilinmaydi. Seed qayta bajarilsa mavjud akkaunt parolini almashtirmaydi. Unutilsa lokal markaz tartibida reset taklifi yoki Django `changepassword` management command’dan foydalaning. Demo production’da DEBUG false sabab rad etiladi. Demo natija/sertifikat yasalmaydi. Kontakt/manzil berilmagan.
