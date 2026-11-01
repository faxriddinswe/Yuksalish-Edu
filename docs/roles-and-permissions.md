# Rollar va vazifalar

## 2026-10-31: kabinetlar va sessiyalar ajratilishi

Rahbarda markazning umumiy ko‘rsatkichlari va oylik moliyaviy xulosa; administratorda qabul, ta’lim va akkaunt amallari; buxgalterda moliyaviy bosh sahifa ochiladi. O‘qituvchi o‘z guruhlari/o‘quvchilari/darslari/sertifikatlarini, o‘quvchi o‘z ta’limi va to‘lovlarini, ota-ona tasdiqlangan farzandlarining ma’lumotlarini ko‘radi. Ota-onaga texnik guruh boshqaruvi o‘rniga farzand guruhlari kartochkalari beriladi. Shaxsiy tafsilotlarda ichki akkaunt va xodim IDlari chiqarilmaydi.

Menyu, mobil navigatsiya va bevosita kabinet manzillari bitta `canOpenSection` qoidasi bilan tekshiriladi. API mustaqil tekshiradi. Buxgalterga dars, a’zolik, xona va kurs boshqaruvi APIlari yopiq; moliyaviy hisobot filtrlariga zarur guruh/fan/ustoz referenslari ochiq. Alohida berilgan `attendance.correct_attendance` uchun darsni o‘qish istisnosi saqlanadi.

Server layout, menyu va sahifalar bitta tasdiqlangan `/me/` identifikatoridan foydalanadi. Har kabinet sessiyasining alohida React Query keshi bor. Kirish/chiqish boshqa tablardagi kabinetlarga maxfiy ma’lumotsiz signal yuboradi; fokus, qaytish, navigatsiya va har 15 soniyada sessiya tekshiriladi. Akkaunt/rol/vakolat o‘zgarsa eski kabinet yashirilib, keshi tozalanadi va yangi sessiyaga mos sahifa ochiladi. Bir akkauntning oddiy qayta tekshiruvida ochiq forma saqlanadi. Tekshiruv muvaffaqiyatsiz bo‘lsa eski shaxsiy ma’lumot ko‘rsatilmaydi.

Oldingi benchmarkdan qolgan 100 ta aniq sun’iy akkaunt satrlari saqlandi, ammo ular nofaol qilindi, rollari tozalandi, `is_test_account` belgisi qo‘yildi va 200 sessiyasi bekor qilindi. Oddiy akkauntlar ro‘yxatiga kirmaydi. Endi `prepare_load` faqat `load_` bazasida ishlaydi. Haqiqiy akkauntlarga rol avtomatik almashtirilmaydi.

Foydalanuvchining yakuniy talabi bo‘yicha rahbar, administrator va buxgalter alohida vazifalarga ega. Rollar bir-biriga avtomatik tenglashtirilmaydi. Menyuni yashirishdan tashqari API ham vakolatni tekshiradi.

| Vazifa | Rahbar | Administrator | Buxgalter |
|---|---|---|---|
| Butun markaz va umumiy moliyaviy holat | Ko‘rish va boshqarish | O‘z operatsion sohasi | Moliyaviy soha |
| Akkaunt yaratish/tahrirlash, oddiy rollar tayinlash | Ha | Ha | Yo‘q |
| Rahbar rolini berish, rahbar akkauntini o‘zgartirish | Ha | Yo‘q | Yo‘q |
| Har qanday qo‘shimcha istisno vakolatini berish | Ha | Yo‘q | Yo‘q |
| Taklif/reset: rahbar akkaunti | Ha | Yo‘q | Yo‘q |
| Taklif/reset: boshqa xodim, o‘quvchi, ota-ona | Ha | Ha | Yo‘q |
| Murojaat/o‘quvchi/ota-ona, bog‘lash va ro‘yxatga olish | Ha | Ha | Zarur profilni o‘qish |
| Guruh/a’zolik, dars/jadval/xona, fan/kurs, ustoz profili | Ha | Ha | Faqat moliyaviy filtr uchun guruh, fan va ustoz referenslarini o‘qish |
| Sayt sozlamalari, ijtimoiy havolalar, FAQ va sertifikatlar | Ha | Ha | Yo‘q |
| O‘quvchi hisoblari, to‘lov, tuzatish/bekor qilish/eski qarz | Ha | Tanlangan o‘quvchi holatini o‘qish | Ha |
| Oldingi sanaga haqiqiy moliyaviy to‘lov kiritish | Ha | Yo‘q | Ha |
| Ustozga oylik/avans va tarixi, asosli bekor qilish | Ha | Yo‘q | Ha |
| Umumiy moliyaviy hisobot/Excel | Ha | Yo‘q | Ha |
| Umumiy xabar yuborish va yuborilganlar tarixi | Ha | Ha | Faqat o‘z xabarlarini o‘qish |
| Umumiy audit | Faqat o‘qish | Yo‘q | Yo‘q |

Administrator hisoblar/to‘lovlar sahifasida avval o‘quvchini tanlaydi. Shundan keyin o‘sha o‘quvchi yozuvlarini o‘qiydi; umumiy moliyaviy ro‘yxat va hisobotga kirmaydi. Buxgalter markazning sayt kontenti, akkauntlar va ta’lim yozuvlarini tahrirlamaydi; hisob/to‘lov uchun kerakli ma’lumotlarni ko‘radi. Uning ixcham menyusi va bannersiz bosh sahifasi saqlangan.

Akkauntdagi mavjud rol nomlari saqlangan; maxsus yangi “hamma narsaga admin” roli yaratilmagan. Administrator o‘z rolini o‘zgartira olmaydi, o‘ziga rahbar yoki istisno moliyaviy vakolat bera olmaydi. Har bir boshqaruv amali auditga yoziladi. Mahsulotdagi rahbar huquqi Django texnik `is_superuser`dan alohida.

Bir nechta rol vakolatli xodim tomonidan ataylab biriktirilsa vakolatlar yig‘iladi. Qo‘shimcha `billing.record_payment`, `billing.backdate_payment`, `billing.correct_finance`, `attendance.correct_attendance` istisnolari rahbar nazoratida saqlanadi. Shaxsiy `TEACHER`, `STUDENT`, `PARENT` kabinetlarining oldingi obyekt doiralari o‘zgarmagan: o‘qituvchi o‘z dars/guruhini, o‘quvchi o‘zini, ota-ona tasdiqlangan farzandlarini ko‘radi.

## O‘chirish va tarix

Rahbar/administrator bog‘lanmagan operatsion yozuvni tafsilot oynasidan “Yozuvni o‘chirish” → “O‘chirishni tasdiqlash” bilan o‘chiradi. API `DELETE` va auditni bir transactionda bajaradi. Tarixiy PROTECT bog‘lanish bo‘lsa aniq xabar qaytaradi: nofaol/arxiv yoki tegishli bekor qilish amalidan foydalaniladi. Taklif tarixi bo‘lgan akkaunt ham o‘chirilmaydi, nofaol qilinadi. O‘z akkauntini o‘chirish yoki nofaol qilish bloklangan.

Pul yozuvlari, hisob tuzatishlari, a’zolik/tarif tarixi va auditni oddiy DELETE/PATCH bilan buzish ochilmadi. Buxgalter va rahbar to‘lovni sabab bilan VOID qiladi, hisobni tuzatish yozuvi bilan o‘zgartiradi; shu tariqa balans va tekshirish tarixi saqlanadi. Administratorga moliyaviy yozuvlar yaratish yoki bekor qilish vakolati berilmagan.

## O‘qituvchi va sertifikatlar

Sertifikatlar bo‘yicha alohida vakolat qo‘shildi: administrator va rahbar barcha yozuvlarni, o‘qituvchi o‘ziga biriktirilgan sertifikatlarni yaratadi, ko‘radi, tahrirlaydi va tasdiq bilan o‘chiradi. Rasm tanlash/almashtirish ham shu doirada. O‘qituvchiga ustoz serverda avtomatik biriktiriladi, boshqa o‘qituvchi yoki uning o‘quvchi/fan bog‘lanishini kiritish rad etiladi. Qoralama rasmlar uchun private preview ham obyekt doirasini tekshiradi.

O‘qituvchining **O‘quvchilar** bo‘limi o‘z guruhlaridagi profillarni o‘qish uchun ochildi. Administrator, rahbar va o‘qituvchida sertifikat olgan/olmagan o‘quvchilar hamda fan filtri bor. Fan, sertifikat nomi va ball ro‘yxatda ko‘rinadi; o‘qituvchida boshqa ustozning natijalari chiqarilmaydi. Haqiqiy sertifikatlar profilga bog‘langan va rasmli bo‘lishi kerak; namuna kartochkalar sanalmaydi. O‘quvchi profilini yaratish/tahrirlash/o‘chirish hamon rahbar/administratorda.

Ushbu sertifikat vakolati o‘qituvchiga FAQ, markaz sozlamalari, akkauntlar, moliya yoki umumiy fan/kurs boshqaruvini ochmaydi. Rahbarning avvalgi to‘liq vakolati saqlangan.

Panel yo‘riqnomasi: [certificate-workspace.md](certificate-workspace.md). Papka orqali qo‘shish: [certificates/README.md](../certificates/README.md).
