# Sertifikat rasmlarini qo‘shish

Sayt sahifasi: `http://localhost:3000/natijalar`.

**GitHub maxfiyligi:** asl rasmlar, fanlarning `certificates.json` fayllari va rozilik qaydlari lokalda saqlanadi; public repozitoriyga yuklanmaydi. Mavjud lokal fayllar o‘chirilmagan. GitHub nusxasida fan papkalari va shaxsiy ma’lumotsiz [certificates.example.json](certificates.example.json) shabloni bor.

Yangi klonda fanlar bazaga kiritilgach `scripts/backend sync_certificates --init` bajaring: u har fan uchun 10 ta lokal bo‘sh yozuv yaratadi va mavjud manifestni almashtirmaydi. Keyin shaxsiy rasm va ma’lumotlarni faqat lokalda to‘ldiring. Ular yangi Git commitlarga avtomatik qo‘shilmaydi.

Eng qulay usul: **Sertifikatlar → Yangi yozuv**. Administrator va rahbar barcha yozuvlarni, o‘qituvchi o‘z o‘quvchi/fani bo‘yicha natijalarni boshqaradi. O‘quvchi profilini tanlang; ism avtomatik to‘ladi. Sarlavha, ball/daraja, qisqa tavsif, fan va rasmni kiriting. Rozilik/maxfiylik tekshiruvini belgilang va nashr holatini “E’lon qilingan” qiling. Fayl yo‘lini yozish shart emas. Panel va o‘quvchilar filtri: [certificate-workspace.md](../docs/certificate-workspace.md).

## Mavjud lokal Ingliz tili namunalari

Mavjud lokal `english/certificates.json` bitta taqdim etilgan rasmga bog‘langan 40 ta namuna kartochkani saqlaydi. Asl rasm, ism, ball va rozilik ma’lumotlari public GitHub nusxasiga kiritilmaydi. Ustoz panelda yoki `teacher_slug` orqali to‘ldiriladi. Bir rasm takrorlangani uchun `is_sample: true` va sahifada “Namuna” belgisi bor. Bu 40 ta alohida tasdiqlangan o‘quvchi natijasi emas; yangi klon ularni avtomatik nashr qilmaydi.

Ism, sarlavha, qisqa tavsif, ball va namuna belgisini shu JSON’dan yoki **Sertifikatlar** panelidan o‘zgartiring. `score` maydoni ball/darajani saqlaydi; `is_sample: false` haqiqiy mustaqil natijalar uchun ishlatiladi. Qayta import JSON qiymatlarini paneldagi tahrirdan ustun qo‘yadi. Bir xil rasm bitta importda bitta media fayliga bog‘lanadi. O‘quvchilar filtrida ko‘rinishi uchun haqiqiy natijani panelda aniq profilga bog‘lang; 40 ta namuna filtrga qo‘shilmaydi.

## Papka orqali — har bir fanda 40 tagacha yozuv

| Fan | Rasm papkasi | Qisqa ma’lumot fayli |
|---|---|---|
| Ingliz tili | `certificates/english/` | `english/certificates.json` |
| Ona tili | `certificates/uzbek/` | `uzbek/certificates.json` |
| Matematika | `certificates/math/` | `math/certificates.json` |
| Kimyo | `certificates/chemistry/` | `chemistry/certificates.json` |
| Biologiya | `certificates/biology/` | `biology/certificates.json` |
| Tarix | `certificates/history/` | `history/certificates.json` |
| Koreys tili | `certificates/korean/` | `korean/certificates.json` |

1. Masalan, mustaqil rasmlarni tegishli fan papkasiga `01.jpg` … `40.jpg` nomida qo‘ying. Ingliz tilining joriy namunalari `Sertifikat_english.jpg`ga bog‘langan. JPG, PNG va WebP qabul qilinadi. JSON’dagi `file` qiymatini aynan moslang: katta-kichik harflar ham bir xil bo‘lsin.
2. Shu papkadagi `certificates.json` faylida mos `slot` yozuvini to‘ldiring. `display_name` — ommaga chiqariladigan ism; `title` — sertifikat/yutuq; `description` — qisqa 1–2 jumla; `achieved_on` — `YYYY-MM-DD` sana yoki `null`. Ustozni ko‘rsatish ixtiyoriy: `teacher_slug`ga mavjud ustoz havola nomini yozing.
3. E’lon qilish uchun `publish: true`, `privacy_reviewed: true` va haqiqiy `consent_record` kerak. Tayyormas yozuvda `publish: false` qolsin. Faqat rasm qo‘yish yozuvni avtomatik e’lon qilmaydi: ism va qisqa ma’lumot ham kerak.
4. Loyiha asosiy papkasidagi terminalda bajaring:

```bash
scripts/backend sync_certificates --dry-run
scripts/backend sync_certificates
```

Birinchi buyruq faqat tekshiradi. Ikkinchisi tayyor yozuvlarni bazaga kiritadi. Saytni yangilang; mavjud ochiq sahifa keshi ko‘pi bilan 60 soniyada yangilanadi. Frontendni qayta build qilish shart emas.

Namuna tuzilma (matnlarni haqiqiy ma’lumotga almashtiring):

```json
{
  "slot": 1,
  "file": "01.jpg",
  "display_name": "E’lon qilinadigan ism",
  "title": "Sertifikat nomi va natija",
  "description": "Natija haqida 1–2 jumlalik qisqa ma’lumot.",
  "score": "Haqiqiy ball yoki daraja",
  "is_sample": false,
  "achieved_on": null,
  "teacher_slug": "",
  "publish": true,
  "consent_record": "Haqiqiy rozilik qaydi",
  "privacy_reviewed": true
}
```

Ingliz tilida 1–40 raqamli namuna yozuvlari, qolgan oltita fanda oldingi 1–10 bo‘sh yozuvlar saqlangan. Boshqa fan fayliga ham noyob `slot` raqami bilan 40 tagacha yozuv qo‘shish mumkin. `--init` yangi fan uchun 10 ta bo‘sh joy tayyorlaydi va mavjud faylni almashtirmaydi. Bo‘sh joylar bazaga yoki saytga soxta natija sifatida yozilmaydi. Qayta import ayni fan/slot yozuvini yangilaydi, nusxa yaratmaydi; o‘zgarmagan yozuv qayta yozilmaydi. Mavjud panel orqali kiritilgan boshqa natijalarga tegilmaydi. JSON yoki rasmlardan biri noto‘g‘ri bo‘lsa butun import yozishdan oldin to‘xtaydi.

Rasm 5 MB dan kichik, tomonlari 16–5000 px bo‘lsin. Server uni optimallashtirib alohida media nusxasini saqlaydi. Faqat manba papkasidan rasmni o‘chirish saytdan olib tashlamaydi. Natijani yashirish uchun boshqaruv panelida holatini “Qoralama” qiling yoki manba rasmni saqlagan holda `publish: false` bilan qayta import qiling. Import qilingan natijani keyin JSON’dan qayta import qilsangiz, JSON qiymatlari paneldagi tahrirni yangilaydi.

Ochiq natijalar sahifasida fanlar alohida, har biridan bir ko‘rishda 40 tagacha kartochka chiqadi. Ko‘proq natija bo‘lsa “Barchasini ko‘rish” va sahifalash orqali qolganlari ham ochiladi. Asosiy sahifaning Natijalar qismi ham 40 tagacha kartochka ko‘rsatadi. Rasm 3:4 portret ramkaga kesilmasdan joylanadi; desktopda 4, planshetda 2, telefonda 1 ustun. Rasm ostida o‘quvchi ismi, fan, ball/daraja va ustoz ko‘rinadi.
