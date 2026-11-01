# API

Prefiks `/api/v1/`. Session cookie HttpOnly; mutatsiyada `X-CSRFToken` kerak. `/auth/session/` GET CSRF token va joriy user, POST login, DELETE logout. `/auth/activate/` POST telefon/kod/parol/purpose bilan faollashtirish yoki reset. `/me/` GET profil, PATCH eski/yangi parol.

Mashina o‘qiydigan tekshirilgan sxema: [openapi.yaml](openapi.yaml). Yangilash: `scripts/backend spectacular --file ../docs/openapi.yaml --validate --fail-on-warn`. Bu buyruq `backend/` ishchi katalogini script orqali tanlaydi. Validation ogohlantirish/xatosida CI muvaffaqiyatsiz tugaydi.

Resurslar: students, parents, parents/links, staff, staff/teachers, subjects, subjects/prices, courses, rooms, groups, enrollments, schedule, lessons, attendance, billing/invoices, billing/payments, billing/adjustments, reports/exports, notifications, content/settings, content/faqs, content/achievements, audit.

Public: `/public/settings/`, `/public/courses/`, `/public/courses/{slug}/`, `/public/teachers/`, `/public/teachers/{slug}/`, `/public/achievements/`, `/public/leads/`.

`public/settings/` javobida `telegram_url`, `instagram_url`, `linkedin_url` ommaviy markaz havolalari mavjud; sozlanmagan qiymat bo‘sh satr. Ularni faqat OWNER_ADMIN `content/settings/{id}/` orqali o‘zgartiradi. Server HTTPS va tegishli tarmoq domenini tekshiradi; o‘zgarish auditga yoziladi.

## Muhim actionlar

| Yo‘l | Amal |
|---|---|
| students/{id}/account/ | O‘quvchiga alohida login yaratish va bir martalik kod |
| staff/{id}/invitation/ yoki parents/{id}/invitation/ | ACTIVATE / RESET taklifini yangilash |
| parents/links/{id}/unlink/ | Sabab bilan vasiylikni ajratish |
| leads/{id}/convert/ | Faqat profil yaratish, akkaunt/hisob yaratmaydi |
| enrollments/{id}/transfer/ | Guruh ko‘chirish: group, on_date, reason |
| enrollments/{id}/end/ | A’zolik tugashi: end_date, reason |
| schedule/{id}/generate/ | Aniq darslarni idempotent yaratish |
| attendance/ POST | Davomat yaratish/tuzatish: lesson, student, status, note, reason |
| attendance/confirm-present/ POST | Lesson ID bo‘yicha faqat belgilanmagan a’zolarni PRESENT sifatida tranzaksiyada saqlash; created soni |
| groups/{id}/members/ GET | Rahbar/administrator yoki guruhning o‘z ustoziga faol tarkib va tasdiqlangan ota-ona kontaktlari; search, page |
| billing/invoices/generate/ | Oy bo‘yicha hisoblar |
| billing/invoices/{id}/confirm/ | Birinchi summa/muddat/sabab |
| billing/invoices/{id}/adjust/ | Asosli moliyaviy tuzatish |
| billing/invoices/opening-balance/ | Boshlang‘ich qarz |
| billing/payments/ POST | Student, amount, paid_on, allocations, note; Idempotency-Key UUID header |
| billing/payments/summary/ GET | Shaxsiy o‘quvchi/vasiylik doirasidagi barcha davr qoldig‘i; ixtiyoriy subject |
| billing/payments/{id}/void/ | Sabab bilan bekor qilish |
| reports/financial/ GET | Oy/fan/guruh/ustoz hisoboti |
| reports/exports/ POST | Fondagi Excel eksport, filterlar body’da |
| reports/exports/{id}/download/ GET | Faqat buyurtma bergan vakolatli xodim |
| notifications/{id}/read/ | O‘qildi belgisi |
| notifications/unread-count/ GET | Faqat o‘ziga tegishli o‘qilmagan xabarlar soni |
| notifications/broadcast/ GET | Rahbar/administrator uchun joriy faol akkauntlar soni |
| notifications/broadcast/ POST | Rahbar/administrator: title (180 belgi), message (5 000 belgi); Idempotency-Key UUID |
| notifications/broadcasts/ GET | Rahbar/administrator yuborgan umumiy e’lonlar tarixi, sahifalangan |

Ro‘yxat shakli: `{count,next,previous,results}`. page_size standart25, maksimum50. Qidiruv faqat tegishli resurslarda `search`. Filtr/sorting aniq allowlist. Private API no-store. `/schema/` va `/docs/` texnik staff autentifikatsiyasi bilan. `/health/` DB readiness ommaviy, `/operations/` faqat rahbar uchun worker/scheduler heartbeat.

Standart xato `{error:{message,details,request_id}}`. Barcha javoblarda `X-Request-ID`. Ichki traceback foydalanuvchiga yuborilmaydi. Moliya va audit umumiy DELETE/PATCH bilan tahrirlanmaydi.

`groups/` javobidagi `student_count` bugungi sanaga mos faol noyob o‘quvchilar soni. `groups/{id}/members/` o‘quvchi ismi, telefon/kontakt, ro‘yxatga olingan va a’zolik sanalari, tasdiqlangan ota-ona/vasiy ismi/munosabati/telefonini beradi. Ichki izoh va moliya yo‘q. Student/parent/accountant bu endpointni ololmaydi; ustoz boshqa guruh ID’sini almashtirib ko‘rolmaydi. Qidiruv o‘quvchi yoki ota-ona ismi/telefoniga ishlaydi.

Davomat POST bir lesson/student uchun upsert: DB unique constraint saqlanadi; mavjud belgi o‘zgarsa `reason` kerak, aynan bir xil holat/izoh qayta yuborilsa yangi audit yoki yozuv yaratilmaydi. `confirm-present/` avval belgilangan ABSENT/LATE/EXCUSED yozuvlarini o‘zgartirmaydi. Bekor qilingan yoki begona dars rad etiladi. `attendance/` javobida `group_name`, `course_name`, `lesson_date` mavjud. O‘quvchi/ota-ona sahifalari 15 soniyada/fokusda yangilanadi. Sof teacher kabinetida `lessons/?from=YYYY-MM-DD&to=YYYY-MM-DD` faqat darsga aynan biriktirilgan ustozning darslarini qaytaradi; sana chegarasi Asia/Tashkent.

Bildirishnomalar `unread=true` va `kind` bilan filtrlanadi. ANNOUNCEMENT barcha faol akkauntlarga yuborilgan markaz e’loni. Har akkaunt o‘z nusxasini ko‘radi/o‘qiydi; begona ID bilan o‘qish belgisi qo‘yilmaydi. Bir xil yuboruvchi/UUID/matn qayta yuborilsa birinchi natija 200 bilan qaytariladi, mazmun yoki yuboruvchi o‘zgarsa rad etiladi. Broadcast va barcha qabul qiluvchilar nusxalari bitta tranzaksiyada yoziladi; yuborish auditga tushadi.

O‘quvchi to‘lovlar tarixi `/billing/payments/` orqali sahifalanadi. `from`/`to` haqiqiy `paid_on` sanasini, `subject` taqsimot fanini, `status` POSTED/VOID holatini filtrlaydi. Har taqsimot fan nomi, hisob davri, summa va o‘sha davrdagi a’zolikdan olingan kurs nomlarini beradi. Kurs tarixi bo‘lmasa fan nomi ko‘rsatiladi. Bir necha fanga taqsimlangan to‘lov tanlangan fanga tegishli bo‘lsa, uning barcha taqsimotlari ko‘rinadi.

`/billing/payments/summary/` javobi: `invoice_count`, `pending_count`, `balance`, `overdue_balance`, `upcoming_balance`, `subjects`. Shaxsiy doira serverda olinadi; boshqa `student` ID yuborish uni kengaytirmaydi. Sana/holat filtrlari qoldiqni yashirmaydi; `subject` qoldiqni tegishli fan bilan cheklaydi. `subjects` barcha shaxsiy fanlarni saqlaydi. Summalar Decimal satrlar sifatida uzatiladi.
