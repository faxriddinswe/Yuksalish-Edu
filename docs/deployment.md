# Production ishga tushirish runbook

Bu topshiriqda real serverga deploy bajarilmadi. Domen reja: yuksalish.sherabod.uz. DNS, hosting, TLS, logo va haqiqiy markaz kontaktlari tashqi talab.

1. Markaz tasdiqlagan kontent, kontaktlar, roziliklar va ichki ma’lumot siyosatini kiriting. Sun’iy demo ma’lumotlarni production bazaga ko‘chirmang.
2. VPS uchun dastlab 4 vCPU / 8 GB ko‘rib chiqilishi mumkin; sizing yakuniy benchmark va budjetga bog‘liq. Bitta VPS yuqori mavjudlik klasteri emas.
3. Yangilangan Linux, Docker Engine va Compose v2 o‘rnating. SSH faqat kalit, firewall’da zarur SSH/80/443. PostgreSQL/Redis internet portlariga chiqarilmaydi.
4. `.env.production.example` dan `.env.production` yarating, chmod 0600. SECRET_KEY kamida 50 tasodifiy belgi, alohida kuchli DB paroli. Aniq ALLOWED_HOSTS va CSRF_TRUSTED_ORIGINS. TRUSTED_PROXY_NETWORKS’ni haqiqiy ichki Nginx tarmog‘iga toraytiring.
5. DNS A/AAAA yozuvlarini siz egalik qiladigan serverga yo‘naltiring. Vakolat berilmaguncha DNS o‘zgartirilmaydi.
6. Ishonchli ACME mijozidan TLS sertifikat oling. `infrastructure/tls/fullchain.pem` va `privkey.pem` readonly mount qilinadi; key 0600. Sertifikat yangilanishi va Nginx reload’ini tashkil qiling. TLS/sertifikat tekshiruvi o‘chirilmaydi.

```bash
docker compose --env-file .env.production -f compose.production.yaml config --quiet
docker compose --env-file .env.production -f compose.production.yaml build
docker compose --env-file .env.production -f compose.production.yaml up -d
docker compose --env-file .env.production -f compose.production.yaml exec backend python manage.py check --deploy
docker compose --env-file .env.production -f compose.production.yaml exec backend python manage.py create_owner --phone +998XXXXXXXXX --name "Rahbar ismi"
```

`compose.production.yaml` mustaqil, lokal Compose ustiga birlashtirilmaydi. Frontend standalone production build, backend Gunicorn 3 worker / 2 thread, Celery alohida worker va bitta Beat. Migratsiya faqat migrate xizmatida bir marta. Restart va persistent volume mavjud. Barcha xizmatlarda JSON log rotation: 10 MB × 3 fayl. Image taglarni qabul sinovidan keyin digest bilan pin qilish tavsiya etiladi.

API uchun Nginx Host, X-Real-IP va X-Forwarded-Proto qiymatlarini qayta yozadi. Django faqat sozlangan ichki proksidan IP oladi. API hostga to‘g‘ridan-to‘g‘ri ochilmaydi. Session Secure/HttpOnly/Lax, CSRF Secure. Ichki Next SSR so‘rovlari trusted HTTPS proxy header bilan API’ga ulanadi. API health redirect’dan istisno, data qaytarmaydi. Media faqat nashr holati va rozilik bo‘yicha Django orqali ochiladi. Texnik `/admin/` Nginx’da yashirilgan; kundalik CRM Next’da.

Lokal `check --deploy` faqat `security.W021` ogohlantirishini berdi: HSTS preload yoqilmagan. Oddiy HSTS yoqilgan. Brauzerlarning uzoq muddatli preload ro‘yxatiga kirish domen egasining alohida qarori bo‘lgani uchun hozir avtomatik yoqilmagan; bu ogohlantirish yashirilmagan. Bu sozlama tekshiruvi haqiqiy TLS sertifikati yoki server konfiguratsiyasi sinovi emas.

## Kuzatuv

- `/api/v1/health/`: DB readiness. Request ID va structured loglar orqali xatoni kuzating.
- Rahbar `/api/v1/operations/`: worker va scheduler oxirgi muvaffaqiyati. Heartbeat 3 daqiqadan oshsa worker/Redis’ni tekshiring; daily catch-up 24 soatdan oshsa Beat tekshirilsin.
- `docker compose ... logs --since 30m backend celery-worker celery-beat`.
- `docker stats`, `df -h`, disk I/O, PostgreSQL ulanishlar, sekin so‘rovlar, Redis xotira va backup yoshini kuzating. Redis uchun host `vm.overcommit_memory=1` parametrini administrator baholaydi; bu topshiriqda tizim sozlamalari o‘zgartirilmagan.
- Xatolik matni, parol, token va cookie logga qo‘shilmasin. Eksportlar private volume, role+owner tekshiruvi bilan.
- Tashqi monitoring, uptime alert va offsite backup hozir yoqilgan emas; server egalari bilan tashkil qilinadi.

## Yangilash

Zaxira → alohida muhitda restore/smoke → migration review → yangi image build → rejalangan maintenance → migrate → xizmatlar → qabul tekshiruvi. Rollback faqat kodni eski image’ga almashtirishdan iborat bo‘lmasligi mumkin: schema mosligini alohida baholang. Sirlarni, sertifikatlarni va `.env.production` ni image yoki gitga kiritmang.
