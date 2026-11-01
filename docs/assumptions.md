# Boshlang‘ich qarorlar

- Bir markaz, bir filial. Foydalanuvchi bir nechta rol olishi mumkin. Django superuser mahsulot roli emas.
- Birinchi fan oyi buxgalter summa VA muddat belgilaguncha `PENDING` bo‘ladi. Nol yoki to‘langan deb hisoblanmaydi. 10-sanadan keyin kelganlarda ham muddatni buxgalter tanlaydi.
- Keyingi oy muddat: 10-sana, shu kun ham kiradi. 11-sana qoldiq muddati o‘tgan hisoblanadi.
- Birinchi oy eslatmasi: belgilangan muddatdan 5 kun oldin; 5 kundan kam vaqt qolganida catch-up vazifasi bir marta yaratadi. Belgilanmagan hisobga pul eslatmasi yo‘q.
- Avans kelishilmagan: qoldiqdan ortiq to‘lov rad etiladi. Avtomatik pro-rata, davomat chegirmasi, chiqish oyini qayta hisoblash yoki qaytarish yo‘q.
- Bir fan/oy uchun hisob noyob. Fan ichidagi guruh ko‘chishi yangi hisob bermaydi. Birinchi oy tushunchasi o‘quvchi–fan munosabatining eng oldingi oyidir.
- Narx topilmasa hisob chiqarish xato qaytaradi; nol narx uydirilmaydi.
- Ichki kontakt, manzil, ish vaqti va xarita hali berilmagan: ommaga soxta ma’lumot chiqarilmaydi.
- Natijalar faqat rozilik qaydi bilan e’lon qilinadi. Demo natijalar real yutuq sifatida chiqarilmaydi.
- Sana Asia/Tashkent; vaqt bazada UTC bilan timezone-aware. Pul Decimal, UZS.
- Audit ilova orqali o‘zgarmaydi; DB administratori qarshisida mutlaq himoya emas.
- 4 vCPU / 8 GB VPS faqat rejalashtirish varianti; resurs kafolati emas.

## Umumiy e’lonlar

Administrator yoki rahbar yuborgan xabar yuborish paytidagi barcha `is_active=True` login akkauntlariga, jumladan yuboruvchining o‘ziga yetkaziladi. Faqat profilga ega, login akkaunti yaratilmagan o‘quvchi mustaqil qabul qiluvchi emas. Akkaunt faollashtirishni hali yakunlamagan, lekin faol akkauntga ega foydalanuvchi xabarni keyingi kirishda ko‘radi. Keyin yaratilgan yoki o‘sha paytda deaktivatsiya qilingan akkauntlarga tarixiy e’lon avtomatik tarqatilmaydi. Yangi e’lon bilan qayta xabardor qilish mumkin.

Bu sayt ichidagi bildirishnoma; Telegram, SMS yoki push yetkazilishi yo‘q. Ochiq kabinetda 60 soniyagacha davriy yangilanish, fokus va keyingi kirish bilan ko‘rinadi. Tarixiy umumiy e’lonlar UI/API’da tahrirlanmaydi yoki izsiz o‘chirilmaydi; zarur tuzatish yangi xabar orqali yuboriladi.

## Davomatning boshlang‘ich tanlovi

O‘qituvchi darsni ochganda belgilanmagan o‘quvchi uchun “Bor” oldindan tanlanadi. Bu saqlanmagan UI tanlovi: sahifani ochishning o‘zi bazaga davomat yozmaydi. O‘qituvchi umumiy saqlash tugmasi yoki o‘quvchi qatoridagi holat tugmasini bosgach haqiqiy yozuv yaratiladi. Umumiy “Bor” saqlashi faqat belgilanmaganlarga ta’sir qiladi; oldin qo‘yilgan belgilar saqlanadi. Oldingi belgini almashtirish sabab bilan bajariladi. O‘quvchi va ota-ona saqlangan natijani 15 soniyalik yangilanish, fokus yoki keyingi kirishda ko‘radi; WebSocket/push va’da qilinmaydi.

