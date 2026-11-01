# Testlar va tekshiruv

Aniq Passed/Failed/Skipped/Unrun natijalari `implementation-status.md` va natija fayllarida. Zero-test run muvaffaqiyat deb hisoblanmaydi.

## Sertifikatlar: administrator/o‘qituvchi CRUD va o‘quvchi filtri

`test_certificate_workspace.py` o‘qituvchi avtomatik biriktirilishi, profil/fan/guruh doirasi, begona sertifikatning GET/PATCH/PUT/DELETE rad javobi, qoralama rasm preview’si, rasm almashtirish, rozilikli nashr va auditli o‘chirishni tekshiradi. Administrator/rahbar CRUD, guruh qayta biriktirilgandan keyin eski sertifikatni tahrirlash, namuna/rasmsiz/bog‘lanmagan yozuvlarni sanamaslik, fan filtri, boshqa ustoz natijasini yashirish va ortiqcha rollarga rad javobi qamrab olingan. 20 ta o‘quvchi sertifikatlari ro‘yxati 4 tadan oshmagan DB so‘rovi bilan tekshiriladi.

`certificate-workspace.test.tsx` o‘qituvchining sertifikat yozishi va o‘quvchi profiliga faqat o‘qish huquqi, formasida ortiqcha ustoz tanlovi yo‘qligi, o‘quvchidan ismning avtomatik to‘lishi, ball/fan/sertifikat ko‘rinishi, buxgalterda filtr yo‘qligi hamda tasdiqli o‘chirishni tekshiradi.

`certificate-workspace.spec.ts` haqiqiy brauzerda ikkala rol bilan o‘quvchini tanlash → sertifikat/rasm qo‘shish → qoralama preview → rasm va ballni almashtirish → nashr → sertifikat olgan o‘quvchini fan bo‘yicha filtrlash → rahbar kabinetida ko‘rish → o‘chirish jarayonini bajaradi. 320/390/768/1440 px va axe tekshiruvlari bor. Yozishlar faqat alohida E2E bazasida. O‘qituvchi navigatsiyasi regressiyasi yangi O‘quvchilar/Sertifikatlar menyularini tasdiqlaydi va boshqa texnik bo‘limlar yopiq qolishini tekshiradi.

Dastlabki integratsiya tekshiruvi o‘qituvchida bo‘sh bo‘lmagan sertifikat ro‘yxatini serializatsiya qilishdagi xatoni topdi: serializer `instance` qiymati listda QuerySet, detailda model edi. Modelga tegishli eski bog‘lanish istisnosi faqat `Achievement` instance uchun ishlatiladigan qilindi; regressiya to‘ldirilgan teacher list javobini ham tekshiradi.

`scripts/smoke-certificate-workspace.mjs` lokal standalone’da administrator, rahbar va o‘qituvchi ruxsatlari, tanlov manbalari, sertifikat formasi va o‘quvchilar filtrini faqat o‘qish/saqlanmaydigan preview bilan tekshiradi. Auth’dan tashqari mutation so‘rovlari bloklanadi. Natijalar `certificate-workspace-smoke-result.json` va `certificate-workspace-result.json`da saqlanadi; asosiy yozuvlar SHA-256 bilan solishtiriladi.

## Backend

```bash
scripts/test-backend --reuse-db --junitxml=../docs/backend-test-results.xml
.venv/bin/ruff check backend
scripts/backend check
scripts/backend makemigrations --check --dry-run
scripts/backend spectacular --file ../docs/openapi.yaml --validate --fail-on-warn
```

`test_*` alohida PostgreSQL bazasida. SQLite ishlatilmaydi. Phone/session/CSRF, invitation expiry/reuse/attempts/reset/deactivation, role/object scope, parent privilege revocation, enrollment/transfer, schedule generation/conflict, roster/attendance, Decimal/partial/full/overpay/allocation/idempotency/rollback/void/adjustment/tariff snapshot, date boundaries/reminders va hisobotlar qamrab olinadi. Parallel to‘lov hamda parallel dars to‘qnashuvi haqiqiy DB row/advisory lock bilan tekshiriladi.

## Frontend va E2E

```bash
npm ci --prefix frontend
npm run lint --prefix frontend
npm run typecheck --prefix frontend
npm run test --prefix frontend
npm run build --prefix frontend
.venv/bin/python scripts/prepare-e2e
npm run e2e --prefix frontend
```

E2E `e2e_<asosiy_baza>` bazasiga ulanadi. 100 ta sun’iy demo bilan boshlanadi; jarayon test yozuvlari faqat shu bazada yaratiladi. Asosiy bazadagi100 o‘quvchi o‘zgarmaydi. Backend 8001, Next 3001, alohida .next-e2e. Chrome `/usr/bin/google-chrome`; boshqa yo‘l `CHROME_PATH`. CI’da Playwright o‘rnatgan Chromium ishlatiladi. Test yopilgach serverlar to‘xtaydi. JSON natija docs/e2e-results.json, xato screenshotlar gitignore’da. Trace maxfiy so‘rovlar yozilmasligi uchun o‘chirilgan.

`scripts/e2e-backend runserver` boshlanishida `reset_e2e_limits` oldingi test kirish urinishlarini tozalaydi. Buyruq faqat DEBUG yoqilgan `e2e_` bazasida ishlaydi; asosiy va production bazalarini rad etadi. Limit miqdori va muddati kamaytirilmaydi yoki o‘chirilmaydi. Redis kesh kalitlari ham har bir E2E server jarayoni uchun alohida prefiks oladi. `test_e2e_setup.py` bu himoyalarni tekshiradi.

E2E oldidan PostgreSQL bilan birga Redis ham ishlayotganini tekshiring. Hozirgi host muhitida mavjud lokal Redis nusxasi alohida terminalda `scripts/start-redis` orqali ishga tushiriladi; boshqa muhitda Compose yoki o‘zingiz sozlagan Redis xizmatini ishlating. Faqat Django serveri yoki health URL javob berishi login va kesh tayyorligini tasdiqlamaydi. Redis o‘chiq bo‘lsa session/public settings so‘rovlari 500, undan keyin CSRF so‘rovlari 403 qaytarishi mumkin.

Flow: kurs→murojaat→administrator ko‘rishi→profilga aylantirish→ota-ona va bog‘lanish→bir martalik faollashtirish→ikkita fan→birinchi hisob→qisman to‘lov→kabinetdagi qoldiq→ustoz davomat→ota-ona→begona ma’lumot404. Responsive 320/360/390/430/768/1024/1440 va axe/keyboard tekshiruvlari. Avtomatik axe to‘liq WCAG kafolati emas; screen reader va real telefonlarda qo‘lda tekshirish kerak.

## Lokal yuklama

```bash
POSTGRES_DB=load_yuksalish scripts/backend prepare_load
# Alohida terminalda production’ga o‘xshash process modeli, faqat localhost:
POSTGRES_DB=load_yuksalish scripts/serve-benchmark
scripts/load-test --profile gunicorn
# Development server taqqoslash:
POSTGRES_DB=load_yuksalish scripts/backend runserver 127.0.0.1:8002 --noreload
# Alohida terminalda:
scripts/load-test --profile development
```

Locust faqat localhost hostlarini qabul qiladi. 100 ta sun’iy xodimga 1 soatlik alohida sessiya; tokenlar .local/load-sessions.json faylida 0600, logga chiqmaydi. O‘quvchi soni oshirilmaydi. Sessiya muddati tugasa prepare_load’ni qaytaring; faylni boshqalarga bermang.

Bir xil4 API: o‘quvchi qidirish(3), guruh(2), jadval(2), moliyaviy dashboard(1). Wait 0.1–0.4s, 10 foydalanuvchi 20 s, 50 foydalanuvchi 30 s, 100 foydalanuvchi 20 s, spawn 10/s. RawCSV docs/load-results. Development va Gunicorn natijalari alohida. Boshlang‘ich p95 maqsad50 parallel o‘qishda1 soniyadan past; o‘lchangan natija maqsadga almashtirilmaydi.

Foydalanuvchi demo hajmini 100 ga tushirdi. Shuning uchun 1 000 ta yozuvli benchmark bajarilgan emas. Bu ishlab chiqarishdagi1 000 ta yoki1 000parallel foydalanuvchiga kafolat bermaydi. Alohida moliyaviy/dars concurrency testlari yaxlitlikni tekshiradi, Locust o‘qish ssenariysi esa tezlikni.

## Backup va CI

`backup-restore-check` haqiqiy custom-format dumpni alohida bazaga tiklaydi va son/summalarni solishtiradi. Ishchi baza o‘rniga tiklamaydi.

GitHub Actions PostgreSQL17/Redis 8 bilan backend lint/check/migration/test, frontend lint/typecheck/unit/build va browser E2E’ni bajaradi. Public repozitoriyga kod yuklanganda workflow ishga tushadi; amaldagi natijani [GitHub Actions](https://github.com/faxriddinswe/Yuksalish-Edu/actions) orqali tekshiring. Lokal test natijasi GitHub CI natijasi sifatida ko‘rsatilmaydi. CI’dagi trust autentifikatsiya faqat vaqtinchalik izolatsiyalangan service bazasiga, production’ga qo‘llanmaydi.

## Kontent va responsive regressiya

`backend/tests/test_content_enrichment.py` haqiqiy PostgreSQL bilan sertifikatni yuklash/e’lon qilish/nashrdan olish, fan filtri, ustoz-fan mosligi, draft rasmlar ruxsati, markaz rasmini matnni tahrirlashda saqlash/olib tashlash, format/hajm/o‘lcham cheklovlari, noyob o‘quvchilar sanog‘i va o‘quvchi taklif ruxsatlarini tekshiradi.

`frontend/tests/unit/content.test.tsx` filtr va forma yorliqlarining mustaqilligi, nullable statistikani tozalash va mavjud rasm bilan matnni tahrirlashni tekshiradi. `frontend/tests/e2e/content.spec.ts` haqiqiy UI orqali markaz/ustoz/sertifikat rasmlarini yuklaydi, matnni tahrirlaydi, natija fan filtrini hamda 320/360/390/430/768/1024/1440 px da public va CRM overflow’ini tekshiradi. Axe tekshiruvlari va Escape bilan fokus qaytishi ham mavjud.

`frontend/tests/fixtures/content-test.png` faqat sun’iy sinov tasviri. `docs/screenshots/` rasmlari alohida E2E bazasidan olinadi: ular haqiqiy markaz, ustoz yoki sertifikat tasviri emas. Asosiy bazada 100 o‘quvchi qolishi alohida smoke bilan tekshiriladi.

## O‘quvchining to‘lovlar tarixi

`backend/tests/test_student_payments.py` shaxsiy qoldiq doirasi, begona ID, tarix bo‘lmasa ham qarz, pending/ma’lumotsiz holatlar, tuzatish va VOID, 10/11-sana, kurs a’zoligi tarixi, ko‘p fan taqsimoti, sana/fan filtrlari va cheklangan DB so‘rovlari sonini tekshiradi. `frontend/tests/unit/student-payments.test.tsx` yashirilgan bo‘limlar, aralash rollar va qarzdorlik holatlari matnlarini tekshiradi. `platform.spec.ts` dagi to‘liq jarayon o‘quvchining yangi tarixi, filtrlari, mobil navigatsiya, 7 o‘lcham, axe va eski manzildan yo‘naltirishni ham qamrab oladi.

## Ijtimoiy tarmoqlar

`backend/tests/test_social_links.py` rahbar tahriri, boshqa rollarga rad javobi, ommaviy API, havolani tozalash, HTTPS/domen tekshiruvi va soxta domen/credential hujumlarini tekshiradi. `frontend/tests/e2e/social-links.spec.ts` rahbar formasidan uch havolani saqlaydi, barcha olti rolning desktop/mobil kabinetida, kirish va public sahifalarda ko‘rinishini, haqiqiy `href`, xavfsiz yangi oyna atributlari, overflow va axe natijasini tekshiradi. Test havolalari faqat alohida E2E bazasiga yoziladi; ijtimoiy tarmoqqa o‘tish yoki tashqi xabar yuborish bajarilmaydi. Asosiy lokal smoke haqiqiy sozlama bo‘sh bo‘lsa faol bo‘lmagan holatni tekshiradi.

Frontend build va E2E dev serverni ketma-ket ishga tushiring: ikkalasi bir vaqtning o‘zida Next yaratadigan TypeScript fayllarini skanerlashi mumkin.

## Guruhlar va umumiy bildirishnomalar

`backend/tests/test_broadcasts.py` barcha olti rolga yetkazish, faqat rahbar/administrator yuborishi, deaktivatsiya qilingan akkauntlarni chetlash, begona xabar ID’sini rad etish, mustaqil o‘qish holati, matn cheklovlari, idempotency, parallel qayta so‘rov, audit va tranzaksiya rollback’ini haqiqiy PostgreSQL bilan tekshiradi.

`frontend/tests/e2e/groups-broadcasts.spec.ts` o‘quvchi guruhlari xodim API’lariga so‘rov yubormasligini, 403 yo‘qligini, qidiruv va jadval havolasini, desktop ustunlarini hamda 320/360/375/390/430/768/1024/1440 px da overflow/ikonalar/ijtimoiy tugmalar to‘qnashmasligini tekshiradi. Administrator xabarining olti rolga ko‘rinishi, o‘qilgan holati va server saqlaganidan keyin tarmoq uzilganda qayta yuborish dublikat yaratmasligi ham tekshiriladi. Axe tekshiruvi mavjud. Umumiy sinov xabarlari faqat alohida E2E bazasiga yuboriladi; asosiy lokal bazada faqat yuborilmaydigan preview tekshiriladi.

`frontend/tests/unit/auth-readiness.test.tsx` server renderida kirish/faollashtirish/tiklash formalari `POST` bilan belgilanganini va JavaScript tayyor bo‘lguncha o‘chirilganini, client tayyor bo‘lgach ishlashini tekshiradi. `frontend/tests/e2e/auth-readiness.spec.ts` JavaScript o‘chirilgan haqiqiy brauzerda uch sahifani tekshiradi. Bu himoya juda tez bosish yoki skript yuklanmasligi sabab maxfiy maydonlar brauzerning odatiy GET so‘rovi URL’iga tushishining oldini oladi.

## O‘qituvchi ish jarayoni va marketing harakatlari

`backend/tests/test_teacher_workspace.py` davomat API’sida unique xatosisiz tuzatish, sabab/audit, aynan qayta so‘rov, umumiy PRESENT tasdiqlash, avvalgi ABSENT yozuvini saqlash, begona/bekor darsni rad etish, rollback va parallel tasdiqlashni tekshiradi. Ota-ona/o‘quvchi scoped javoblari, guruh tarkibidagi tasdiqlangan kontaktlar, ajratilgan ota-ona kontakti yo‘qolishi, qidiruv va 4 DB so‘rovi bilan tarkib olish, faol noyob odamlar sanog‘i, o‘rinbosar dars va Toshkent sana chegaralari ham tekshiriladi.

`frontend/tests/unit/teacher-workspace.test.tsx` soddalashtirilgan sof teacher navigatsiyasi, aralash rahbar roli, Toshkent kuni va 7 kunlik davrning oy/yil chegaralarini tekshiradi. `frontend/tests/e2e/teacher-workspace.spec.ts` guruh tarkibi/telefonlar, 8 ekran o‘lchami, 7 kunlik jadval, oldindan tanlangan saqlanmagan PRESENT, umumiy saqlash va ABSENT/LATE tuzatishni haqiqiy API bilan bajaradi. Ochiq turgan ota-ona va o‘quvchi sahifasida aynan shu darsning o‘zgarishini qayta navigatsiyasiz kutadi; 15 soniyalik refetch sinovdan o‘tadi. Marketing scroll/reduced motion, mobil overflow va axe ham tekshiriladi.

Bu yozuvchi sinovlar faqat E2E bazasida. `teacher-smoke-result.json` asosiy standalone muhitda guruhlar/jadval/davomatning faqat o‘qish orqali tekshirilganini, asosiy davomat soni o‘zgarmaganini saqlaydi.

`frontend/tests/unit/focus-refresh.test.tsx` haqiqiy `Providers` va QueryClient bilan o‘quvchi/ota-onaning davomat ro‘yxati va bosh sahifa kartasi hamda bildirishnomalar inbox’ini tekshiradi. Dastlabki javobdan keyin API natijasi o‘zgartiriladi va kabinetga fokus qaytariladi: yangi qiymat 15/60 soniyalik interval yoki 30 soniyalik stale vaqtini kutmasdan ko‘rinishi kerak. Ushbu beshta regressiya tuzatishdan oldin yiqilgan, tegishli query’larda `refetchOnWindowFocus: "always"` belgilanganidan keyin o‘tgan. Umumiy QueryClient sozlamasi saqlangan.

`teacher-workspace.spec.ts` guruh tarkibidan “Dars jadvali”ga, jadvaldan “Davomat”ga haqiqiy havolalarni bosadi va tanlangan guruh/dars ID’sini tekshiradi. `platform.spec.ts` o‘quvchi tafsilotidan “Hisoblarini ko‘rish” va “To‘lov kiritish” havolalarini bosib, o‘quvchi tanlovi saqlanganini tekshiradi. To‘g‘ridan-to‘g‘ri `page.goto` bilan kirish client navigatsiyasidagi parametr yo‘qolishini ushlamagan edi; dastlabki standalone smoke aynan jadval → davomat o‘tishida yiqildi. Sahifa endi Next.js `searchParams` qiymatlarini kutib, boshlang‘ich tanlovlarni komponentlarga uzatadi; URL o‘zgarganda forma holati ham yangidan boshlanadi.

## Buxgalter paneli

`backend/tests/test_accountant_workspace.py` ustoz to‘lovining ruxsatlari, UUID qayta so‘rov/konflikt, audit, bekor qilish, davr va haqiqiy sana, faol bo‘lmagan ustoz, noyob faol o‘quvchi/guruh sanog‘i va N+1 cheklovini tekshiradi. Harfli ustoz qidiruvi telefon raqamidagi raqam bilan boshqa ustozni qo‘shmasligi uchun regressiya bor. O‘quvchi ismi/familiyasi katta-kichik harf va so‘zlar tartibi bilan tekshiriladi. Tez to‘lov Decimal FIFO, parallel qayta yuborish, 25 dan ko‘p hisobga taqsimlash va ortiqcha summa rollback’ini qamraydi. Hisobot fan/guruh/ustoz bo‘yicha aniq taqsimotni oladi; haqiqiy HTTP Excel oqimi va eski asinxron faylda son/sana/bo‘sh summa/formula himoyasi hamda yig‘indilar tekshiriladi.

`frontend/tests/unit/accountant-workspace.test.tsx` haqiqiy Providers bilan yashirilgan menyu/banner, rahbar vakolatining saqlanishi, klaviatura bilan tanlash, summa tozalash, qoldiqdan ortiq summani rad etish, server xatosida yolg‘on muvaffaqiyat ko‘rsatmaslik va ustoz to‘lovidan keyin tarix/jamilar yangilanishini tekshiradi.

`frontend/tests/e2e/accountant-workspace.spec.ts` haqiqiy brauzerda buxgalter menyusi, ustoz qidiruvi/sonlari, ustoz to‘lovini saqlashdan keyin javob uzilishi va takrorda dublikat bo‘lmasligi, katta-kichik harfli o‘quvchi tanlovi, qo‘lda summa saqlash, qoldiq hamda haqiqiy Excel download’ni tekshiradi. Sakkiz ekran o‘lchami, uch moliyaviy sahifada axe va JavaScript xatolari tekshiriladi. Yozishlar faqat E2E bazasida.

`scripts/smoke-accountant.mjs` yangilangan standalone `localhost:3000`da asosiy bazani o‘qiydi: ustoz/o‘quvchi to‘lovlari faqat tasdiqlashgacha ko‘rsatiladi, auth’dan boshqa barcha browser mutation so‘rovlari bloklanadi. Eski hisoblar bo‘yicha taqsimot, sakkiz ekran o‘lchami va haqiqiy Excel yuklash tekshiriladi. `.local/accountant-report.xlsx` va API kutilgan summalari keyin openpyxl bilan solishtiriladi. Oldin/keyin o‘nta biznes modelining barcha yozuvlari SHA-256 orqali solishtiriladi; asosiy bazada yangi ustoz to‘lovi 0 bo‘lishi kerak. Natijalar `accountant-smoke-result.json` va `accountant-result.json`da.

## Vazifalar bo‘yicha rollar va sertifikatlar

`test_management_roles.py` rahbar/administrator akkaunt yaratish va oddiy rolni o‘zgartirishini, boshqa xodimga taklif berishni, ishlatilmagan yozuvni audit bilan o‘chirishni tekshiradi. Taklif/tarix bilan bog‘langan akkaunt o‘chirilmaydi, nofaol qilinadi. O‘z akkaunti, rahbar akkaunti va rol/vakolat ko‘tarish himoyalari, kontent CRUD, tarixiy PROTECT hamda buxgalter/o‘qituvchi/o‘quvchi/ota-onaga texnik o‘zgartirishlar rad etilishi tekshiriladi.

`test_certificate_import.py` 10 ta joyni buzmasdan tayyorlash, dry-run, idempotent import, nashrdan olish, fayl yo‘li/format/rozilik/bo‘sh ism xatolarida bazaga yozmaslik hamda 10 ta natijani public API’dan olishni tekshiradi. Sinov rasmlari faqat vaqtinchalik MEDIA_ROOT’da.

`roles-certificates.test.tsx` rollarning mustaqilligi, administrator formasida rahbar va istisno vakolatlari yo‘qligi, o‘chirish tasdig‘i, tanlanmagan o‘quvchi uchun taqiqlangan moliya so‘rovi yuborilmasligi va har fan uchun 40 ta kartochka olinishi/sahifalash havolasini tekshiradi. Ball, namuna belgisi va ustoz noma’lum holati ham tekshiriladi. `roles-certificates.spec.ts` haqiqiy administrator akkaunt yaratish/tahrirlash/o‘chirishini, moliyaviy API rad javobini, sayt sozlamalariga ruxsatni va ikkita fandagi test sertifikatlarini tekshiradi: birinchi fanda 41, ikkinchisida 40 ta yozuv yaratiladi. Har bo‘limning birinchi ko‘rinishida 40 tadan kartochka, keyingi sahifada qolgan 1 ta, orqaga qaytganda 40 ta natija va qidiruv saqlanishi tekshiriladi. Bir xil qatordagi kartochkalar balandligi, 3:4 rasm ramkasi, sakkiz ekran, real rasm yuklanishi, fan filtri va axe tekshiriladi. Buxgalterning texnik bo‘limlarga kirishi rad etiladi, hisoboti ishlaydi.

`public-pagination.spec.ts` kurslar, ustozlar va natijalar sahifasida oltita noto‘g‘ri/eskirgan sahifa raqamini tekshiradi. Umumiy xato sahifasi o‘rniga haqiqiy sahifa va mos bo‘sh natija ko‘rinishi, qidiruv va tanlangan fan saqlanishi hamda JavaScript xatosi yo‘qligi talab qilinadi. Natijalar regressiyasi tuzatishdan oldin umumiy yuklash xatosida yiqildi. Dastlabki davom ettirishdagi 4 E2E natijasi `resume-pagination-e2e-result.json`da; `e2e-results.json` kechagi to‘liq 12 ta testning tarixiy dalili sifatida saqlandi. O‘sha dastlabki standalone smoke uch havola va har fandan ko‘pi bilan 10 ta kartochkani faqat o‘qish orqali tekshirgan; joriy limit 40 ga yangilangan.

## 40 ta sertifikat gridi — joriy tekshiruv

`test_forty_sample_cards_share_one_image_and_preserve_score` 40 ta namuna yozuvini import qiladi: public API 40 tasini qaytarishi, ball/namuna belgisi saqlanishi, diskda bitta rasm bo‘lishi va qayta import yangi yozuv/fayl yaratmasligi talab qilinadi. To‘liq backend: 170 Passed, 0 Failed/Skipped; `certificate-grid-backend-tests.xml`.

`roles-certificates.spec.ts`, `content.spec.ts`, `public-pagination.spec.ts` birgalikda 6 Passed, 0 Failed/Skipped/Flaky; `certificate-grid-e2e-results.json`. `scripts/smoke-certificate-grid.mjs` asosiy bazada faqat o‘qiydi: bosh sahifa va Ingliz tili bo‘limida 40 tadan kartochka, 1440/1024/768/540/430/390/360/320 px da aniq 4/2/1 ustun, 3:4 ramka, rasm/ism/fan/ball/ustoz holati va xatolarni tekshiradi. Dalil: `certificate-grid-smoke-result.json`. Umumiy rol smoke ham yangilangan 40 ta limit va jami 100 metadata slotga mos; `roles-certificates-smoke-result.json`.

Joriy to‘liq natija `certificate-grid-result.json`da. `resume-result.json`, `resume-pagination-e2e-result.json` va oldingi 10 tadan/70 slotli tekshiruvlar tarixiy holat sifatida saqlanadi.
