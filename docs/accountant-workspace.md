# Buxgalter kabineti

Buxgalter bosh sahifasidan markaz tanishtiruv banneri va menyusidan darslar/jadval, xonalar, guruh a’zoliklari, fanlar, kurslar olib tashlandi. Bu ma’lumotlar bazada saqlanadi. Rahbar/administrator bilan aralash rollar boshqaruv vakolatlarini saqlaydi.

## Ustozlar va to‘lovlar

`/kabinet/teachers` buxgalterga ustozlarning moliyaviy kartochkalarini ochadi. Rahbar avvalgi ustoz profilini boshqaradi; profil ichidagi “To‘lovlar va tarix” havolasi `/kabinet/teacher-finance?teacher=ID` ga olib boradi.

Ustoz to‘lovi — markaz ustozga bergan oylik yoki avans. Ish haqi formulasi berilmagani uchun avtomatik oylik hisoblash, ustozga qarz yoki foyda chiqarish qo‘shilmadi. Summa qo‘lda kiritiladi. O‘quvchilar to‘lagan kontrakt pullari bilan bu xarajatlar aralashtirilmaydi.

Ustozni ism yoki telefon bilan toping, davrni tanlang va “To‘lovlar va tarix”ni oching. Kartochka bugungi faol a’zoliklar va faol guruhlardan noyob faol o‘quvchilarni sanaydi: bir odam ikki guruhda bo‘lsa bir marta hisoblanadi. Bu tarixiy oy bo‘yicha o‘quvchilar snapshoti emas. Tanlangan oy uchun va barcha davrlarda berilgan summalar alohida ko‘rsatiladi.

“Ustozga to‘lov kiritish”da davr oyi, haqiqiy to‘lov sanasi, musbat summa va izoh kiritiladi. Masalan, oktabr oyligi noyabrda berilsa davr oktabr, sana noyabr bo‘ladi. Kelajak to‘lov sanasi qabul qilinmaydi; eski haqiqiy sanani kiritish mumkin. Tekshirish oynasidan keyin tasdiqlanadi. Tarmoq javobi yo‘qolib qayta bosilsa bir xil so‘rov ikkinchi yozuv yaratmaydi.

Tarixda davr, sana, summa, kiritgan xodim, izoh va holat bor; “Barcha oylar tarixi” filtrini yoqish mumkin. Xato yozuvni rahbar yoki buxgalter sabab bilan bekor qiladi. Yozuv o‘chirilmaydi, jami summaga qo‘shilmaydi. Faol bo‘lmagan ustoz tarixi saqlanadi, yangi to‘lov kiritilmaydi.

## O‘quvchidan to‘lov qabul qilish

`/kabinet/record-payment`da ism, familiya yoki telefon yozing. Harf kattaligi va ism-familiya so‘zlari tartibi qidiruv natijasini o‘zgartirmaydi. Qidiruv 180 ms kutadi, oldingi so‘rov bekor qilinadi, bir safar ko‘pi bilan 10 natija ko‘rsatiladi. Sichqoncha yoki ↑/↓ va Enter bilan tanlang; Escape ro‘yxatni yopadi.

“Tez to‘lov”da bitta summani qo‘lda kiriting. Tasdiqlashdan keyin server barcha ochiq tasdiqlangan hisoblardan muddat, oy va ID bo‘yicha eng eskisini birinchi qoplaydi. Sahifalash cheklovi taqsimotga ta’sir qilmaydi. Summa jami qoldiqdan oshsa hech narsa saqlanmaydi. Belgilanmagan birinchi hisobga pul taqsimlanmaydi: avval uning summasini tasdiqlash kerak. Aniq fanga/hisobga to‘lash uchun “Hisoblar bo‘yicha” usuli saqlangan.

Boshqa o‘quvchini qidirishni boshlaganda oldingi tanlov va summa tozalanadi. Pul `Decimal`, ikki kasrgacha; tasdiqlash oynasi tanlangan odam va summani yana ko‘rsatadi. Rahbar va buxgalter oldingi haqiqiy to‘lov sanasini ham kirita oladi; administrator moliyaviy yozuv kiritmaydi.

## Excel

`/kabinet/exports`da oy, fan, guruh, ustoz va o‘quvchi qidiruvi bo‘yicha filtrlab “Excel yuklab olish”ni bosing. Moliyaviy dashboard tugmasi ham shu yuklashdan foydalanadi. HTTP javobi bevosita `.xlsx` fayl beradi; fon workerini kutish shart emas. Eski asinxron eksport API’si ishlashda davom etadi.

Fayl bitta PostgreSQL snapshotidan tayyorlanadi va to‘qqiz varaq beradi:

| Varaq | Ma’lumot |
|---|---|
| Statistika | Summalar, o‘quvchi va hisob sonlari, qarz, ustoz to‘lovlari |
| Hisoblar | Tanlangan oy hisoblari, tuzatish, to‘langan, qoldiq, muddat |
| Oldingi qarz | Oldingi oylar ochiq hisoblari |
| O‘quvchilar | Har odam bo‘yicha jamlangan hisob/to‘lov/qoldiq va holat |
| Tushumlar | Haqiqiy sanasi tanlangan oyga tushgan har bir taqsimot |
| Tuzatishlar | Tanlangan hisoblar tuzatishlari, sabab va xodim |
| Ustozlar - davr | Tanlangan oy uchun ustozga berilgan to‘lovlar |
| Ustozlar - sana | Haqiqiy sanasi tanlangan oyga tushgan ustoz to‘lovlari |
| Izohlar | Filtrlar va ko‘rsatkichlar ma’nosi |

Fan bo‘yicha tushum aynan shu fanga taqsimlangan summadan olinadi; ikki fanga bo‘lingan to‘lov ikki marta to‘liq hisoblanmaydi. Guruh/ustoz filtri fan va hisob oyi bilan kesishgan a’zolikni tekshiradi. Bekor qilingan to‘lovlar jamiga kirmaydi. Summalar Excel sonlari, sanalar sana kataklari; belgilanmagan summa bo‘sh qoladi. Matndagi formula belgilari bajarilmaydigan ko‘rinishda yoziladi.

Ustoz xarajati faqat ustoz filtri bilan torayadi. Fan/guruh/o‘quvchiga ish haqi taqsimlash qoidasi berilmagan: bu filtrlar bilan ustoz xarajati sun’iy bo‘linmaydi. Bu cheklov faylning “Izohlar” varag‘ida ham ko‘rsatiladi. Markazdagi jami/faol o‘quvchilar ko‘rsatkichi umumiy, tanlangan hisoblardagi o‘quvchilar soni esa filtrlangan.

Tekshiruvlar va saqlanish dalillari: [testing.md](testing.md), [accountant-result.json](accountant-result.json).
