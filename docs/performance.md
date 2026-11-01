# Lokal yuklama natijalari

## 2026-10-31: sinov akkauntlari ajratildi

Quyidagi o‘lchovlar tarixiy. Yangi benchmark bu rol auditida bajarilmadi. Eski 100 yuklama akkaunti ishchi bazada nofaol qilindi, rollari tozalandi va sessiyalari bekor qilindi; biznes yozuvlari saqlandi. `prepare_load` va `scripts/serve-benchmark` endi faqat `load_` bilan boshlanadigan alohida bazaga ruxsat beradi.

Yangi sinov uchun PostgreSQL’da alohida `load_yuksalish` bazasini yaratib, `POSTGRES_DB=load_yuksalish scripts/backend migrate`, `POSTGRES_DB=load_yuksalish scripts/backend seed_demo --students 100`, `POSTGRES_DB=load_yuksalish scripts/backend prepare_load` ketma-ket bajariladi. Development: `POSTGRES_DB=load_yuksalish scripts/backend runserver 127.0.0.1:8002 --noreload`; Gunicorn: `POSTGRES_DB=load_yuksalish scripts/serve-benchmark`. `scripts/load-test --profile development` va `--profile gunicorn` ikkalasi ham ajratilgan localhost:8002 xizmatiga so‘rov yuboradi. Ishchi localhost:8000 yuklama nishoni emas.

2026-10-30. Foydalanuvchining so‘nggi topshirig‘i bo‘yicha **100 ta sun’iy o‘quvchi**, 134 a’zolik, 403 hisob va 197 to‘lov. 1 000 o‘quvchili sinov bajarilmadi. O‘quvchi soni parallel foydalanuvchi soni emas; yuklama uchun alohida sun’iy xodim sessiyalari yaratildi.

## Muhit va metod

Lokal Linux noutbuk: 12 mantiqiy CPU, taxminan 14 GB RAM; Python 3.14.4, PostgreSQL 15.19, Redis 8.0.5, Locust 2.47.0. Bu VPS resurslariga tenglashtirilmaydi. PostgreSQL va API localhost’da; tarmoq kechikishi, TLS va Nginx/Next yo‘li bu API benchmarkiga kirmaydi. CPU/RAM ishlatilishining vaqt qatori alohida o‘lchanmagan.

Bir xil ssenariy: o‘quvchi qidirish (vazn 3), guruhlar (2), aniq darslar (2), moliyaviy dashboard (1). Vakolatli haqiqiy session va haqiqiy PostgreSQL so‘rovlari; mock javoblar yo‘q. Kutish 0,1–0,4 soniya. 10 foydalanuvchi — 20 soniya, 50 — 30 soniya, 100 — 20 soniya; har soniyada 10 ta foydalanuvchi qo‘shiladi. Bu qisqa sinov, uzoq davom etadigan barqarorlik tekshiruvi emas.

Development profili Django runserver’da; Gunicorn profili DEBUG=false, 3 worker × 2 thread. Ssenariy va dataset o‘zgartirilmagan. Gunicorn o‘lchovi davomida E2E/build ishga tushirilmagan; fon worker/Beat va asosiy lokal xizmatlar mavjud bo‘lgan. Development natijasidan keyin lokal Django `CONN_MAX_AGE=0` qilindi; sinxron Gunicorn’da 60 soniyalik qayta foydalanish saqlandi. Parallel DB ulanishlari ish jarayonlari bilan cheklanadi.

## Natijalar

Quyidagi sonlar saqlangan yakuniy `*_stats.csv` fayllarining `Aggregated` qatoridan. Locust chiqish paytidagi konsol sonlari tugayotgan so‘rovlar sabab biroz farq qilishi mumkin.

| Profil | Parallel foydalanuvchi | So‘rov | Xato | p95 | So‘rov/soniya |
|---|---:|---:|---:|---:|---:|
| Development | 10 | 594 | 0 | 200 ms | 31,2 |
| Development | 50 | 1 189 | 0 | 1 900 ms | 39,6 |
| Development | 100 | 988 | 352 (35,6%) | 4 000 ms | 49,4 |
| Gunicorn | 10 | 627 | 0 | 160 ms | 33,0 |
| Gunicorn | 50 | 2 646 | 0 | 540 ms | 88,0 |
| Gunicorn | 100 | 1 767 | 0 | 1 100 ms | 88,1 |

Boshlang‘ich maqsad — 50 parallel o‘qish ssenariysida p95 < 1 soniya — **Gunicorn profilida bajarildi**, development profilida bajarilmadi. 100 foydalanuvchida p95 1 soniyadan oshdi. Development 100 ssenariysida PostgreSQL ulanish limiti bilan 500 xatolar bo‘lgan; muvaffaqiyatsiz natijalar yashirilmagan. Gunicorn’dagi jarayon cheklovi bilan qayta o‘lchashda bu xatolar kuzatilmadi.

Dastlabki development xom fayllari: `load-results/users-*_*.csv`. Gunicorn: `load-results/gunicorn/users-*_*.csv`. Sandboxning lokal socketni bloklagan texnik urinishlari benchmark sifatida olinmagan; ruxsat berilgach haqiqiy lokal so‘rovlar bajarilgan. Test faqat shu loyihaning localhost xizmatlariga yuborildi.

## Yaxlitlik va keyingi tekshiruv

Pul/davomatni Locust orqali nazoratsiz ko‘paytirish o‘rniga alohida PostgreSQL test bazasidagi tranzaksiya testlari ishlatildi: parallel to‘lovda ortiqcha qoplash rad etilishi, rollback, takroriy idempotency so‘rovi, parallel xona/ustoz bandligi va davomat cheklovlari. Bu o‘qish benchmarkidan alohida tekshiruv.

Production’dan oldin tanlangan VPS’da 1 000 o‘quvchili alohida sun’iy dataset, uzoqroq yuklama, TLS/gateway, real telefon/tarmoq va CPU/RAM/disk kuzatuvi bilan takrorlash kerak. Hozirgi natija 1 000 parallel foydalanuvchi yoki yuqori mavjudlik kafolati emas. Bitta VPS klaster emas.
