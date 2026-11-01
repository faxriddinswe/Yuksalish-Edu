# Loyiha holati — WIP

2026-11-01. **Loyiha ishlab chiqilmoqda va hali yakunlanmagan.** GitHub’dagi public nusxa dastur kodi, migratsiyalar, testlar, konfiguratsiya namunalari va yo‘riqnomalardan iborat. Bu production relizi yoki ishchi bazaning nusxasi emas.

## Hozir mavjud

- Ochiq sayt: kurslar, ustozlar, natijalar va aloqa/murojaatlar.
- Oltita rol: rahbar, administrator, buxgalter, o‘qituvchi, o‘quvchi va ota-ona. Menyu va API ruxsatlari alohida tekshiriladi.
- O‘quvchilar, akkaunt/takliflar, ota-ona bog‘lanishi, guruhlar, jadval va davomat.
- Moliyaviy hisoblar, qo‘lda to‘lov, taqsimot va tuzatishlar, ustoz to‘lovlari, Excel hisobotlar.
- Administrator/rahbar va o‘qituvchi doirasida sertifikat CRUD, rasmlar va sertifikat olgan o‘quvchilar filtri.
- Sessiya/kesh ajratilishi, tablar orasida akkaunt almashishini tekshirish, responsive kabinetlar.

## Tekshiruv holati

Oxirgi lokal rol auditida 202 backend va 60 frontend testi o‘tgan. 25 ta alohida brauzer ssenariysining oxirgi natijalari o‘tgan; ular rol tekshiruvi, regressiya va xato tuzatilgandan keyingi qayta tekshiruvlardan yig‘ilgan. Build, TypeScript, lint va API sxemasi ham tekshirilgan. Bu tashqi GitHub CI yoki production qabul sinovi o‘rnini bosmaydi. Lokal batafsil hisobotlar va skrinshotlar maxfiylik sabab Git’ga kiritilmaydi.

## Davom ettiriladigan ishlar

- Markazning haqiqiy, tasdiqlangan kontenti va natijalarini vakolatli panel orqali kiritish.
- Foydalanuvchi bilan qolgan talab va kamchiliklarni tekshirish, real qurilmalarda qabul sinovlari.
- Production muhitida DNS/TLS, maxfiy sozlamalar, monitoring va serverdan tashqari backup/restore tartibini yakunlash.
- GitHub Actions natijalarini kuzatish va keyingi o‘zgarishlarni tekshiruvlar bilan davom ettirish.

Public nusxaga shaxsiy sertifikatlar yoki ishchi baza qo‘shilmagan. Yangi klonda ma’lumotlarni lokal test uchun yaratish va ishga tushirish tartibi [README](../README.md) da. Mavjud lokal ishlar va baza GitHub’ga tayyorlashda o‘chirilmaydi yoki qayta yaratilmaydi.
