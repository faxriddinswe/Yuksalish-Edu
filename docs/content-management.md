# Markaz, ustoz va natijalarni boshqarish

## Markaz ma’lumotlari

Rahbar yoki administrator **Markaz sozlamalari** orqali uch bo‘limni tahrirlaydi:

- **Matn va bo‘limlar**: banner sarlavhasi, tanishtiruv, markaz haqida, maqsad, ta’limga yondashuv, sharoitlar, qabul bosqichlari.
- **Markaz rasmlari**: banner va ichki muhit uchun alohida suratlar, o‘qiladigan rasm izohi.
- **Aloqa va e’lonlar**: ommaviy telefon, manzil, ish vaqti, xarita havolasi, Telegram, Instagram, LinkedIn va ixtiyoriy e’lon.

Ma’lumotlar ochiq saytda va kabinetdagi **Markaz haqida** sahifasida bir manbadan ko‘rsatiladi. O‘quvchi bosh sahifasida tanishtiruv banneri chiqarilmaydi. Ochiq sayt keshi yangilanishi bir daqiqagacha vaqt olishi mumkin.

Telegram, Instagram va LinkedIn manzillarini rahbar yoki administrator **Markaz sozlamalari → Aloqa va e’lonlar** orqali to‘liq HTTPS havola shaklida kiritadi. Faqat tegishli tarmoq domenlari qabul qilinadi: `t.me`/`telegram.me`, `instagram.com` va `linkedin.com` (oxirgi ikkitasida `www` ham mumkin). Soxta manzil avtomatik qo‘yilmaydi. Bo‘sh maydon “Havola kiritilmagan” holatini ko‘rsatadi; mavjud havola yangi oynada ochiladi. Havolani vaqtincha olib tashlash uchun tegishli maydonni tozalab saqlang.

Uch tarmoq ochiq sayt footerida, kirish/faollashtirish/tiklash sahifalarida hamda barcha olti rol kabinetining footer, yon menyu va mobil menyusida bitta markaz sozlamasidan chiqadi. Bu markazning ommaviy tarmoqlari; xodim yoki o‘quvchining shaxsiy akkauntlari avtomatik e’lon qilinmaydi.

“Namuna muhiti” standart e’loni olib tashlangan; migratsiya aynan oldingi avtomatik matnni tozalaydi, rahbar yozgan boshqa e’lonni o‘chirmaydi. Sun’iy o‘quvchi yoki ustoz nomlari haqiqiy shaxs nomiga avtomatik almashtirilmaydi. Haqiqiy surat bo‘lmasa, neytral dekorativ kompozitsiya ishlatiladi. Markaz tarixi, ochilgan yil, manzil yoki statistikalar uydirilmaydi.

## Ustozlar

**Ustozlar** bo‘limida akkaunt, ommaviy ism, fanlar, qisqa tavsif, surat, tajriba, malaka va nashr holati boshqariladi. Shaxsiy akkaunt telefoni ommaga avtomatik chiqmaydi; ommaviy aloqa maydoni alohida.

Tasdiqlangan jami o‘quvchilar soni berilgan bo‘lsa, shu son ko‘rsatiladi. Maydon bo‘sh qolsa, CRM’dagi ustoz guruhlariga a’zo bo‘lgan noyob o‘quvchilar sanaladi. Bir o‘quvchi ikki a’zoligi sabab ikki marta sanalmaydi; ikki manba qo‘shilmaydi. Oldingi faoliyat bo‘yicha raqamni vakolatli xodim tasdiqlashi kerak.

## Natijalar va sertifikatlar

Administrator va rahbar barcha natijalarni, o‘qituvchi o‘z natijalarini **Sertifikatlar → Yangi yozuv** orqali boshqaradi:

1. O‘quvchi profilini tanlang; e’lon qilishga ruxsat berilgan ism avtomatik to‘ladi. Yutuq sarlavhasi, tavsif va ball/darajani kiriting.
2. Fan, tayyorlagan ustoz va sertifikat sanasini tanlang. Ustoz tanlangan fanga biriktirilgan bo‘lishi kerak; o‘qituvchi kabinetida ustoz avtomatik o‘z profiliga belgilanadi.
3. Sertifikatdagi keraksiz shaxsiy ma’lumotlarni oldindan berkitib, **Rasm yuklash** orqali faylni tanlang.
4. Rozilik qaydini kiriting, maxfiylik tekshiruvini tasdiqlang va nashr holatini tanlang.
5. Saqlang. Rasm va roziliksiz natija e’lon qilinmaydi. Administrator, rahbar va tegishli o‘qituvchi vakolati doirasida nashr qilishi mumkin; o‘quvchining o‘zi nashr qilmaydi.

**O‘quvchilar → Sertifikat holati / Sertifikat fani** orqali haqiqiy sertifikat olgan profillar ajratiladi va fan/sertifikat/ball ko‘rinadi. Namuna, rasmsiz va profilga bog‘lanmagan eski natijalar bu filtrga kirmaydi. CRUD va rasm boshqaruvi bo‘yicha to‘liq yo‘riqnoma: [certificate-workspace.md](certificate-workspace.md).

Ochiq **Natijalar** sahifasida fan bo‘limlari, o‘quvchi/sertifikat/ustoz bo‘yicha qidiruv va sahifalash mavjud. Kartochkada sertifikat, ism, fan, ustoz, sana va tavsif ko‘rinadi. Rasm alohida ochib kattalashtiriladi. Ustoz sahifasida uning o‘quvchilarining tegishli natijalari chiqadi.

## Rasm talablari

JPEG, PNG yoki WebP; 5 MB gacha, har tomoni 16–5000 px. Server haqiqiy formatni tekshiradi, 1800 px gacha kichraytiradi, JPEG sifatida yangi tasodifiy nom bilan qayta yozadi; asl fayldagi metadata ko‘chirilmaydi. SVG/HTML qabul qilinmaydi. Bu shaxsiy ma’lumotlarni suratning o‘zidan avtomatik yashirmaydi: operator ko‘zdan kechiradi.

Tanlangan rasm saqlashdan oldin ko‘rinadi. Matnni tahrirlash mavjud rasmni saqlaydi. **Rasmni almashtirish** va **Rasmni olib tashlash** alohida amallar. Draft sertifikat/ustoz rasmlarini ommaviy media yo‘li bermaydi; muharrir ko‘rishi autentifikatsiya va `no-store` orqali himoyalangan. Brauzer sinov suratlari alohida E2E bazasiga yoziladi; ular asosiy saytda haqiqiy natija sifatida nashr qilinmaydi.

Nashrdan olingan suratning Next.js optimizator keshida qolmasligi uchun yuklangan media brauzerga to‘g‘ridan-to‘g‘ri, `no-store` bilan uzatiladi. Server rasmlarni oldindan kichraytiradi. Ommaga bir marta e’lon qilingan rasmning tashqi nusxalarini texnik yo‘l bilan qaytarib olish kafolatlanmaydi.

## Sertifikatlarni fan papkalaridan qo‘shish

`certificates/` ichida 7 ta fan papkasi bor. Shaxsiy `certificates.json` va rasmlar faqat lokalda saqlanadi, public GitHub nusxasiga kiritilmaydi. Yangi klonda `scripts/backend sync_certificates --init` har bir faol fan uchun 10 ta bo‘sh joy yaratadi; mavjud lokal ma’lumotni almashtirmaydi. Har fan uchun 40 tagacha slot qabul qilinadi. Rasmlarni tegishli fan papkasiga qo‘yib, qisqa ma’lumotni JSON’da to‘ldiring, so‘ng `scripts/backend sync_certificates --dry-run` va `scripts/backend sync_certificates` bajaring. Faqat rasmni ko‘chirish avtomatik nashr qilmaydi; ma’lumot, rozilik va nashr belgisi ham kerak. O‘qituvchi/administrator uchun oddiy kundalik usul — paneldagi Sertifikatlar formasi.

To‘liq yo‘l xaritasi va nusxa ko‘chirish mumkin bo‘lgan namuna: [certificates/README.md](../certificates/README.md). Sahifa har fan uchun bir ko‘rishda 40 tagacha sertifikatni 4/2/1 ustunli, 3:4 ramkali kartochkalarda ko‘rsatadi; ko‘proq yozuv bo‘lsa fan ichida sahifalanadi. Mavjud natijalar saqlanadi.
