# Zaxira va tiklash

Production DB va media doimiy volume’da. `infrastructure/backup/backup.sh` custom formatdagi PostgreSQL dump va media tar arxivini chiqaradi. `.env.production` faqat serverda 0600 ruxsat bilan. Arxivlar shaxsiy ma’lumot; ruxsat 0600, katalog 0700. Serverdan tashqarida shifrlangan nusxa va alohida credential kerak. Hozir offsite saqlash yoqilmagan.

Tavsiya retention: 7 kundalik, 4 haftalik, 6 oylik nusxa. Eski nusxani faqat yangi zaxira, offsite nusxa va restore tekshiruvi muvaffaqiyatidan keyin o‘chiring. Siyosat markaz tomonidan tasdiqlansin. Dastlabki RPO 24 soat, RTO 4 soat rejalashtirish maqsadi, amaliy kafolat emas.

## Lokal restore tekshiruvi

```bash
.venv/bin/python scripts/backup-restore-check
```

Script `pg_dump -Fc` oladi, tasodifiy `restore_check_*` bazasini yaratadi, `pg_restore --single-transaction --exit-on-error` bilan tiklaydi. O‘quvchilar, a’zoliklar, hisoblar, to‘lovlar, taqsimotlar, audit sonlari va amaldagi to‘lov summasini solishtiradi. Ishchi bazani almashtirmaydi. Vaqtinchalik bazani tekshiruvdan keyin olib tashlaydi. Natija `docs/backup-restore-result.json` da. Arxiv `.local/backups` ichida, gitga kirmaydi.

## Production runbook

1. Avariya sababini aniqlang; yangi yozuvlarni vaqtincha to‘xtating. Joriy holatdan alohida zaxira oling.
2. Oxirgi tekshirilgan DB/media juftini toping. Avval izolyatsiyalangan muhitga tiklang.
3. Asosiy bazaga tegmasdan yangi bazani yarating:

```bash
docker compose --env-file .env.production -f compose.production.yaml exec postgres createdb -U yuksalish restore_review
docker compose --env-file .env.production -f compose.production.yaml exec -T postgres pg_restore -U yuksalish --exit-on-error --single-transaction --no-owner --no-acl -d restore_review < /xavfsiz/joy/postgres.dump
```

4. Media arxivini alohida katalogga ochib, fayllar soni va ruxsatlarni tekshiring. DB/media va moliyaviy balanslar mosligini tekshiring.
5. Rahbar tasdig‘i va rejalashtirilgan maintenance vaqtida ulanishni tiklangan bazaga o‘tkazing. Worker va Beat’ni ham bir xil bazaga o‘tkazing. So‘ng login, jadval, qoldiq va to‘lovni tekshiring.
6. Natija va uzilish vaqtini qayd eting. Bu hujjat real production tiklash bajarilganini anglatmaydi.
