# Hisob va to‘lov qoidalari

Pul Decimal, UZS, ko‘pi bilan ikki kasr. Tarif `SubjectPrice(subject, effective_from, amount)` orqali. Boshlang‘ich demo narx har fan uchun 300 000 so‘m, ikki fan uchun 600 000 so‘m. Chiqarilgan hisob summasi snapshot; keyingi tarif o‘zgarishi unga tegmaydi.

## Davr va birinchi hisob

Bir o‘quvchi + fan + oyning 1-sanasi bazada noyob. Shu oyda a’zolik bilan kesishuvchi davr bor bo‘lsa hisob yaratiladi. Eng ilk fan oyida summa va muddat `NULL`, holat `PENDING`. Buxgalter musbat summa, muddat va sabab bilan tasdiqlaydi. Nol yoki to‘langan deb ko‘rsatilmaydi. 10-sanadan keyin kelganlar uchun ham muddatni buxgalter belgilaydi. Keyingi oylarda o‘sha oyning 1-sanasi uchun amaldagi tarif olinadi, muddat 10-sana.

10-sana ham muddat ichida; faqat `due_date < Asia/Tashkent bugungi sana` bo‘lsa overdue. Qatnashmaslik hisobni o‘zgartirmaydi. Chiqish oyini qayta hisoblash, refund, pro-rata va avans avtomatik yo‘q. A’zolik tugagan keyingi oylar hisoblanmaydi. Tarixiy guruhga o‘tish hisobni takrorlamaydi.

## Formulalar

- Yakuniy hisob = `Invoice.amount + SUM(Adjustment.amount)`.
- To‘langan = `SUM(PaymentAllocation.amount WHERE Payment.status=POSTED)`.
- Qoldiq = yakuniy hisob − to‘langan.
- Oy uchun hisoblangan = tanlangan oy hisoblarining yakuniy summalari. PENDING summaga qo‘shilmaydi, alohida sanaladi.
- Oy ichida tushgan pul = `Payment.paid_on` tanlangan oyda bo‘lgan POSTED to‘lovlarning filtrga mos hisoblariga tegishli `PaymentAllocation.amount` yig‘indisi. Kiritilgan vaqt boshqa tushuncha.
- Shu oy hisoblari uchun to‘langan = tanlangan oy Invoice’lariga amaldagi taqsimotlar, Payment sanasidan qat’i nazar.
- Oldingi davr qarzi = tanlangan oydan oldingi tasdiqlangan hisoblarning musbat qoldiqlari.
- Hali muddati kelmagan qoldiq = musbat qoldiq va due_date ≥ bugun.
- Muddati o‘tgan qarz = musbat qoldiq va due_date < bugun.
- O‘quvchi holati oy ichidagi barcha hisoblar bo‘yicha guruhlanadi: hammasi tasdiqlangan va qoldiq 0 → to‘liq; biror to‘lov va qolgan/pending hisob → qisman; aks holda to‘lamagan/belgilanmagan. Odam bir marta sanaladi.

Hisobot va diagramma `/reports/financial/` manbasidan. Kartochkalar tegishli hisob filtrlariga olib boradi. Fan/guruh/ustoz filtrlari mos hisoblar va ularga tegishli aniq taqsimot summalarini tanlaydi. Guruh va ustoz hisob fani hamda hisob oyi bilan kesishgan a’zolik orqali aniqlanadi. Bir to‘lov ikki fanga bo‘linsa faqat mos qismi tushumga kiradi.

## Yozuvlar yaxlitligi

O‘quvchi kabinetida alohida oylik hisoblar jadvali chiqarilmaydi. “To‘lovlar tarixi” sahifasi haqiqiy to‘lov sanasi, kurs/fan, davr, to‘langan summa va umumiy qarzdorlik holatini ko‘rsatadi. Eski `/kabinet/invoices` manzili o‘quvchi uchun `/kabinet/payments`ga yo‘naltiriladi. Buxgalter va ota-ona hisob interfeyslari o‘z vakolatlari bilan ishlaydi.

Shaxsiy jami qoldiq barcha davrlardagi tasdiqlangan hisoblarning musbat qoldiqlaridan olinadi; muddati o‘tgan va hali muddati kelmagan qismlar ajratiladi. To‘lovlar tarixi bo‘sh bo‘lishi qarz yo‘qligini anglatmaydi. Birinchi summa belgilanmagan yoki hali hisob bo‘lmagan holat “Qarzdorlik yo‘q” deb ko‘rsatilmaydi. VOID to‘lov tarixda qoladi, balansni kamaytirmaydi. Sana/holat filtri faqat tarixga, fan filtri tarix va qoldiqqa ta’sir qiladi.

To‘lov va taqsimot bitta transaction. O‘quvchi va hisoblar row lock bilan qulflanadi. Taqsimot musbat, yig‘indisi to‘lovga teng, har biri hisob qoldig‘idan oshmaydi. Hisob bir o‘quvchiga tegishli, tasdiqlangan bo‘lishi kerak. UUID idempotency key va so‘rov fingerprint takroriy yuborishni ajratadi; bir key boshqa mazmun bilan ishlatilsa rad etiladi.

Bekor qilish sababli `VOID` holati, kim va qachon saqlanadi; to‘lov/taqsimot o‘chirilmaydi. Tuzatish alohida yozuv, yakuniy hisobni to‘langan summadan pastga tushirmaydi. Oldingi sanaga haqiqiy to‘lovni rahbar/buxgalter kiritadi; boshqa rolda alohida rahbar bergan permission kerak. Boshlang‘ich qarz alohida invoice belgisi, davri, holat sanasi va sababi bilan.

## Tez to‘lov va ustoz xarajati

`POST billing/payments/` da `allocations` berilmasa, server o‘quvchini qulflab, barcha ochiq tasdiqlangan hisoblarni muddat/oy/ID bo‘yicha FIFO qoplaydi. Bo‘sh `allocations: []` avtomatik to‘lov hisoblanmaydi va rad etiladi. Qoldiqdan ortiq summa transactionni to‘liq qaytaradi; idempotent qayta yuborishda yangi taqsimot tuzilmaydi. `GET billing/payments/options/?student=ID` tanlash uchun jami qoldiq va hisob sonlarini beradi.

`TeacherPayment` markazdan ustozga qo‘lda berilgan oylik/avans; o‘quvchi `Payment` va uning hisoblaridan alohida. `month` davr, `paid_on` haqiqiy sana. Musbat Decimal, UUID/fingerprint, ustoz row lock va audit mavjud. Oylik formulasi/qarz/foyda avtomatik hisoblanmaydi. Rahbar yoki buxgalter sabab bilan VOID qiladi; tarix o‘chmaydi. Hisobot davr summasi va haqiqiy sanadagi xarajatni alohida beradi. Ustoz xarajati faqat ustoz bilan filtrlanadi, fan/guruh/o‘quvchiga taqsimlanmaydi.

Bevosita Excel `GET reports/financial/download/` bitta DB snapshotidan to‘qqiz varaq beradi; asinxron eksport ham shu generatorni ishlatadi. To‘liq foydalanish: [accountant-workspace.md](accountant-workspace.md).

## Eslatmalar

Standart hisob uchun 5-sanadan boshlab qoldiq bo‘lsa bir marta. Birinchi oyda muddatdan 5 kun oldin; vazifa vaqtida ishlamagan bo‘lsa keyingi catch-up bir marta yaratadi. Foydalanuvchi va bog‘langan har bir ota-ona uchun dedupe unique. Qisman to‘lovdan keyin xabar qoldig‘i yangilanadi; to‘liq qoplanganda hal qilingan belgisi qo‘yiladi. Sayt yopiq bo‘lsa keyingi kirishda ko‘rinadi. Push/SMS/Telegram yo‘q.
