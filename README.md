# Yuksalish Edu

 Bu repozitoriy ishlab chiqish jarayonidagi kod va yo‘riqnomalarni saqlaydi; tayyor production relizi emas. Joriy imkoniyatlar va qolgan ishlar: [loyiha holati](docs/project-status.md).

Public repozitoriyga parollar, lokal baza, o‘quvchilarning sertifikat rasmlari/JSON ma’lumotlari, eksportlar va shaxsiy test hisobotlari kiritilmaydi. Ular lokalda saqlanadi. Faqat bo‘sh `.env` namunalari mavjud. Tekshirish tartibi: [GitHub va maxfiylik](docs/github-publishing.md).

Bir filialli o‘quv markazi uchun ommaviy sayt, CRM va o‘quvchi/ota-ona/xodim kabinetlari. Interfeys va hujjatlar o‘zbekcha. Next.js 16 / React 19 / TypeScript, Django 5.2 LTS/DRF, PostgreSQL, Redis, Celery/Beat, Nginx. Bu ichki boshqaruv va hisob vositasi, fiskal chek tizimi emas.

## Tez boshlash — Docker

Docker Engine va Compose v2 o‘rnatilgan bo‘lishi kerak.

```bash
python3 scripts/init-env
docker compose build
docker compose up -d
# Migratsiya migrate xizmati orqali avtomatik, zaruratda:
docker compose run --rm migrate
# Mahsulot rahbari (parol terminalda maxfiy so‘raladi):
docker compose exec backend python manage.py create_owner --phone +998XXXXXXXXX --name "Rahbar ismi"
```

Oching: **http://localhost:8080**. Django superuser mahsulot rahbari emas. Ichki texnik admin kerak bo‘lsa:

```bash
docker compose exec backend python manage.py createsuperuser
```

## 100 ta demo o‘quvchi

```bash
docker compose exec backend python manage.py seed_demo --students 100
```

`init-env` yaratgan `.env` ichidagi `DEMO_PASSWORD` lokal demo paroli. Parol hujjat yoki kodga yozilmaydi. Seed qayta ishlaganda mavjud parollar o‘zgarmaydi. Demo faqat DEBUG lokal muhitda ishlaydi, tashqi xabar yubormaydi. Sun’iy ma’lumotlar ochiq saytda ham namuna ekanligi bilan belgilanadi; real sertifikat/yutuq yasalmaydi.

| Rol | Telefon |
|---|---|
| Rahbar | +998900000001 |
| Administrator | +998900000002 |
| Buxgalter | +998900000003 |
| O‘quvchi | +998900000004 |
| Ota-ona | +998900000005 |
| Birinchi ustoz | +998901000000 |

Yangi o‘quvchi: administrator profil yaratadi → guruhga yozadi → zarur bo‘lsa “Kabinet akkaunti yaratish” → kodni shaxsga beradi → `/faollashtirish` da foydalanuvchi parol belgilaydi. Ota-ona alohida akkaunt va tasdiqlangan farzand bog‘lanishiga ega. Parolni tiklash administrator shaxsni tekshirgach yangi RESET taklifi orqali.

## Tekshirish va kundalik buyruqlar

```bash
docker compose exec backend pytest
docker compose exec frontend npm run lint
docker compose exec frontend npm run typecheck
docker compose exec frontend npm run test
docker compose logs -f backend celery-worker celery-beat
docker compose down
```

Docker’siz ishga tushirish: [lokal qo‘llanma](docs/local-development.md). Shu ish muhitida frontend **http://localhost:3000**, backend **http://127.0.0.1:8000** uchun tayyorlangan. Servis jarayonlari to‘xtasa qo‘llanmadagi terminal buyruqlari bilan qayta ishga tushiring.

```bash
# Hostda dependency va .env.local tayyor bo‘lgach:
scripts/test-backend
npm run test --prefix frontend
npm run build --prefix frontend
# Asosiy bazaga tegmaydigan E2E bazasi:
.venv/bin/python scripts/prepare-e2e
npm run e2e --prefix frontend
# Ishchi bazani almashtirmaydigan haqiqiy restore sinovi:
.venv/bin/python scripts/backup-restore-check
```

E2E uchun lokal Chrome yoki CI’da Playwright Chromium kerak. Docker ichidagi frontend tasviri browser OS dependencylarini o‘z ichiga olmaydi; E2E host yoki CI’da bajariladi. Yuklama sinovi faqat localhost’da: [test qo‘llanmasi](docs/testing.md).

## Moliya

Har fan va oyga alohida hisob. Boshlang‘ich tarif bazada 300 000 so‘m. Birinchi oy summasi va muddati buxgalter tomonidan belgilanmaguncha `PENDING`. Keyingi oylar muddat 10-sana, 11-sanadan qoldiq overdue. Qo‘lda qisman/to‘liq to‘lov, ko‘p hisobga taqsimot, UUID idempotency, atomik tranzaksiya va qoldiqdan ortiq to‘lovni rad etish mavjud. To‘lov o‘chirilmaydi, sabab bilan bekor qilinadi. Tarif o‘zgarishi oldingi hisobga tegmaydi. [Batafsil qoidalar](docs/billing-rules.md).

## Hujjatlar

- [Loyiha holati va qolgan ishlar](docs/project-status.md), [yuklama metodikasi va tarixiy natijalar](docs/performance.md)
- [Mahsulot talablari](docs/product-spec.md), [taxminlar](docs/assumptions.md)
- [Arxitektura](docs/architecture.md), [ER model](docs/data-model.md), [ruxsatlar](docs/roles-and-permissions.md)
- [Akkaunt va parollar](docs/account-access.md), [markaz, ustoz va sertifikatlar](docs/content-management.md)
- [API](docs/api.md), [dizayn](docs/design-system.md), [testlar](docs/testing.md)
- [Production runbook](docs/deployment.md), [backup/restore](docs/backup-and-restore.md), [maxfiylik va saqlash](docs/data-policy.md)

## Production’dan oldin

Haqiqiy logo, telefon, manzil, ish vaqti, xarita, ustoz/kurs kontenti, natijalar roziligi, hosting, DNS va TLS kerak. `compose.production.yaml` alohida konfiguratsiya; `.env.production.example` asosida kuchli maxfiy qiymatlar belgilanadi. Production’da demo ma’lumot/parol ishlatilmaydi. Offsite backup, tashqi monitoring va real qurilmalarda qabul tekshiruvini tashkil qiling.

Lokal tekshiruv production qabul sinovi o‘rnini bosmaydi. Ushbu muhitda Docker CLI bo‘lmagani uchun Compose konteynerlari ishga tushirilgan deb hisoblanmaydi. GitHub’ga kod yuklash serverga deploy yoki loyihani yakunlash hisoblanmaydi.
