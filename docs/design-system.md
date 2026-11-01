# Dizayn tizimi

Ochiq sayt tanishtirishga, kabinet kundalik vazifalarga yo‘naltirilgan. Brend nomi matn bilan, soxta tasdiqlangan logo yo‘q. Almashtirish yo‘li `frontend/public/brand/README.md` da.

| Token | Qiymat |
|---|---|
| Navy | #14213D |
| Teal | #0F766E |
| Sahifa | #F8FAFC |
| Sirt | #FFFFFF |
| Matn | #0F172A |
| Ikkilamchi matn | #475569 |
| Dekorativ chegara | #E2E8F0 |

Shrift tashqi so‘rovsiz Arial/DejaVu Sans/system sans. Oddiy matn 16px, yordamchi yozuvlar kontekstga mos. Moliyaviy raqamlar tabular. Pul `300 000 so‘m` yoki `300 000,25 so‘m`, sana `30.10.2026, 14:00`, Asia/Tashkent. Formatlar brauzerdagi o‘zbek lokal ma’lumotlari mavjudligiga bog‘liq emas. Input chegaralari dekorativ chegaradan quyuqroq, ko‘rinadigan fokus halqasi bor. Holatlar matn va rang bilan.

Mobil menyu 4–5 asosiy amal va Yana. Katta ekranda yon navigatsiya. Jadval faqat o‘z konteynerida scroll qiladi. Dialog Radix focus trap bilan. Formada server xatosi qiymatlarni tozalamaydi. Moliyaviy amal faqat server tasdiqlagach muvaffaqiyatli ko‘rsatiladi. Reduced motion va safe-area padding bor.

Maqsad WCAG 2.2 AA. Avtomatik axe, klaviatura va o‘lcham tekshiruvlari to‘liq accessibility kafolati emas. Ishga tushirishdan oldin real screen reader va turli qurilmalar bilan qo‘lda qabul tekshiruvi zarur.

## Markaz va kontent sahifalari

Markaz banneri navy fonda matn va alohida rasm maydonidan iborat. Surat berilmasa, CSS orqali neytral ta’lim kompozitsiyasi ko‘rsatiladi. Markaz haqida sahifasida ta’limga yondashuv, maqsad, qabul va aloqa alohida o‘qiladigan bo‘limlardir. Kabinetda shu komponentlarning ixcham ko‘rinishi ishlatiladi.

Natijalar kartochkasi sertifikatning butun ko‘rinishini saqlaydi (`object-fit: contain`); ustoz surati esa portretga mos ravishda joylashadi. Fanlar tugmali havolalar bilan ajratiladi; tanlov URL’da saqlanadi. Qidiruv va server sahifalash tanlangan fanni saqlaydi.

Sertifikat ramkasi barcha ekranlarda **3:4**. 1024 px va undan katta ekranlarda **4 ustun**, 540–1023 px da 2, undan kichik ekranlarda 1 ustun. Bir qatordagi kartochkalar teng balandlikda; ism sarlavha, fan yorliq, ball/daraja alohida ixcham satr va ustoz pastki qismda ko‘rsatiladi. Ustoz noma’lum bo‘lsa “Ko‘rsatilmagan” yoziladi. `is_sample` rasmdagi “Namuna” belgisi bilan farqlanadi. Fan bo‘limida bir sahifada 40 ta kartochka — desktopda 10 qator; asosiy sahifaning Natijalar gridi ham shu komponentdan foydalanadi.

600 px gacha CRM ro‘yxatlari maydon nomlari bilan kartochka ko‘rinishiga o‘tadi; jadvalning sarlavha va katak semantikasi saqlanadi. 768 px gacha markaz/ustozning ikki ustunli tuzilmalari bitta ustunga o‘tadi. Rasm yuklashda ko‘rish, almashtirish va olib tashlash amallari aniq ko‘rsatiladi; asosiy amal saqlashdir. Formadagi va filtrdagi bir xil model maydonlari mustaqil, noyob HTML identifikatorlariga ega.
