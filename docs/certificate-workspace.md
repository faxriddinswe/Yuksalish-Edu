# Sertifikatlarni boshqarish va o‘quvchilar filtri

Administrator va rahbar **Sertifikatlar** bo‘limida barcha yozuvlarni boshqaradi. O‘qituvchi shu bo‘limda o‘ziga biriktirilgan natijalarni ko‘radi, qo‘shadi, tahrirlaydi va tasdiqdan so‘ng o‘chiradi. Ruxsatlar API’da ham tekshiriladi; boshqa ustozning yozuvini ID orqali ochish mumkin emas.

## Qo‘shish va tahrirlash

1. **Sertifikatlar → Yangi yozuv**ni bosing.
2. **Sertifikat olgan o‘quvchi**ni ro‘yxatdan tanlang. Ommaga chiqariladigan ism avtomatik to‘ladi; kerak bo‘lsa uni rozilikka moslab tahrirlang. Yangi haqiqiy yozuv formasida o‘quvchi tanlash talab qilinadi.
3. Sertifikat nomi, fan, **Ball / daraja**, sana va qisqa tavsifni kiriting. Ball matni `57 ball · B2`, `IELTS 7.5` yoki boshqa haqiqiy natija bo‘lishi mumkin.
4. **Rasm yuklash** orqali JPEG, PNG yoki WebP tanlang; oldindan ko‘rish, almashtirish va olib tashlash mavjud. Limit 5 MB va 5000 × 5000 px. Server rasmni tekshiradi va metadata’ni tozalaydi.
5. O‘qituvchida ustoz o‘z profiliga avtomatik biriktiriladi. O‘qituvchi o‘quvchining o‘zi dars bergan fan/guruhiga bog‘liqligini chetlab o‘ta olmaydi. Administrator/rahbar mos fan bo‘yicha ustozni tanlay oladi.
6. Qoralama sifatida saqlash mumkin. Ochiq Natijalar sahifasiga chiqarish uchun rasm, rozilik qaydi, maxfiylik tekshiruvi va **E’lon qilingan** holati kerak.

Tahrirda rasmni qayta tanlash shart emas. E’lon qilingan yozuvdan rasmni olib tashlash uchun avval qoralama holatiga o‘tkazing; rasmsiz natija ommaga chiqarilmaydi. O‘chirish tasdiqlanadi va auditga yoziladi. Guruh keyin boshqa ustozga berilgan bo‘lsa ham eski sertifikatning ustoziga o‘z avvalgi natijasini tuzatish imkoniyati saqlanadi.

O‘qituvchi yangi natija kiritishi uchun faol ustoz profili kerak. Sertifikat huquqi unga sayt sozlamalari, akkauntlar, moliya yoki boshqa ta’lim yozuvlarini boshqarish huquqini bermaydi. **O‘quvchilar** bo‘limi o‘qituvchiga o‘z guruhlaridagi profillarni o‘qish uchun ochiq; o‘quvchi profili tahriri administrator/rahbarda qoladi.

## Sertifikat olgan o‘quvchilar

O‘qituvchi, administrator va rahbar **O‘quvchilar** bo‘limida:

- **Sertifikat holati → Sertifikat olganlar** yoki **Sertifikat olmaganlar**ni tanlaydi.
- **Sertifikat fani** bilan tegishli fan bo‘yicha ajratadi. Fan va “olmaganlar” birga tanlansa aynan shu fandan sertifikati yo‘q profillar chiqadi.
- Jadval va mobil kartochkada fan, sertifikat nomi, ball/daraja va ustoz ko‘rinadi. O‘quvchi tafsilotidan **Sertifikatlarini boshqarish** havolasi shu profil bo‘yicha filtrlangan ro‘yxatni ochadi.

Hisobga olinadigan sertifikat — profilga aniq bog‘langan, rasmli va **Namuna** belgisi o‘chiq yozuv. Ichki ro‘yxatda qoralama sertifikat ham hisobga olinadi; uning ommaga chiqarilishi alohida boshqariladi. Namuna, rasmsiz yoki o‘quvchiga bog‘lanmagan eski natija bu filtrga qo‘shilmaydi.

Oldingi 40 ta Ingliz tili namuna kartochkasi saqlangan. Ular ism o‘xshashligi bo‘yicha avtomatik profilga bog‘lanmaydi va 40 ta haqiqiy sertifikat olgan o‘quvchi deb sanalmaydi. Mavjud eski haqiqiy natijani administrator aniq o‘quvchiga bog‘lashi mumkin.

O‘qituvchi filtr va tafsilotda o‘ziga biriktirilgan sertifikatlarni ko‘radi. Administrator va rahbar umumiy natijalarni ko‘radi. Buxgalter, ota-ona va o‘quvchiga ushbu ichki sertifikat boshqaruvi yoki filtrlar ochilmagan. Public API’da ichki `student` ID yoki profil nomi chiqarilmaydi; faqat rozilik bilan kiritilgan ommaviy ism ko‘rinadi.

## API

- CRUD: `/api/v1/content/achievements/`; filtrlari `student`, `subject`, `teacher`, `publication_status`, `is_sample`.
- Sertifikat uchun fan tanlash: `/api/v1/content/achievements/subjects/`. O‘qituvchiga faqat o‘z fanlari qaytadi; umumiy ta’lim boshqaruvi ochilmaydi.
- O‘quvchilar: `/api/v1/students/?has_certificate=true&certificate_subject=<fan-id>`.
- Student javobidagi readonly `certificates` va `certificate_count` faqat administrator/rahbar/o‘qituvchiga, ularning ko‘rish doirasida beriladi.
- `content.0009_achievement_student` ixtiyoriy `PROTECT` bog‘lanish qo‘shadi; oldingi yozuvlarda `NULL`, moliyaviy va ta’lim ma’lumotlari saqlanadi.
