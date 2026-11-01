# Akkaunt va parollar

Administrator foydalanuvchining doimiy parolini belgilamaydi va ko‘rmaydi. U bir martalik kod beradi; akkaunt egasi o‘z parolini o‘zi tanlaydi. Ochiq mustaqil ro‘yxatdan o‘tish yo‘q.

| Kim uchun | Kim yaratadi | Kabinetdagi yo‘l |
|---|---|---|
| O‘quvchi | Rahbar yoki administrator | O‘quvchilar → Yangi yozuv → saqlash → Tafsilot → Kabinet akkaunti yaratish → noyob login telefoni → Tasdiqlash. |
| Administrator | Rahbar yoki administrator | Xodimlar / takliflar → Yangi yozuv → telefon, ism va Administrator roli → saqlash → Tafsilot → Faollashtirish / tiklash kodi → Faollashtirish. |
| Buxgalter | Rahbar yoki administrator | Xodimlar / takliflar → Yangi yozuv → telefon, ism va Buxgalter roli → saqlash → Tafsilot → Faollashtirish / tiklash kodi. |
| O‘qituvchi | Rahbar yoki administrator | Xodimlar / takliflar → Yangi yozuv → telefon, ism va Ustoz roli → saqlash → Tafsilot → Faollashtirish / tiklash kodi → Faollashtirish. Keyin Ustozlar bo‘limida shu akkauntga ustoz profili, fanlar, rasm va tavsif biriktiriladi. |
| Ota-ona | Rahbar yoki administrator | Ota-onalar → akkaunt yaratish → Farzandlar va vasiylar orqali bola biriktirish → ota-ona tafsilotidan faollashtirish kodi. |

Foydalanuvchi `/faollashtirish` sahifasida telefon, berilgan kod, yangi parol va uning takrorini kiritadi. Keyingi kirish `/kirish` orqali telefon va parol bilan amalga oshiriladi. Parol kamida 10 belgi bo‘lsin; faqat raqamli, juda keng tarqalgan yoki foydalanuvchiga juda o‘xshash parollar serverda rad etiladi. Har bir odam o‘ziga xos parol tanlashi kerak.

Kod 24 soat va bir marta amal qiladi; 5 ta noto‘g‘ri urinishdan keyin yangisi kerak. Yangi kod eskisini bekor qiladi. Bazada kodning xeshi saqlanadi, asl kod faqat chiqarilgan oynada ko‘rinadi. Kodni faqat shaxsi tekshirilgan egasiga markaz tartibiga muvofiq bering. Uni ochiq e’lon qilmang.

## Unutilgan parol

Markaz xodimi shaxsni tekshiradi. Tegishli foydalanuvchi tafsilotida **Faollashtirish / tiklash kodi → Parolni tiklash** tanlanadi. O‘quvchi uchun bu amal O‘quvchilar bo‘limida ham mavjud. Egasi `/parolni-tiklash` sahifasida yangi kod bilan yangi parol belgilaydi. Eski parol ko‘rsatilmaydi. Oddiy xodimlar taklifini rahbar yoki administrator chiqaradi. Rahbar akkauntiga taklifni faqat rahbar beradi; administrator o‘z rolini yoki qo‘shimcha istisno vakolatlarini o‘zgartira olmaydi.

Kirish imkoniyati bor foydalanuvchi **Profil va parol** bo‘limida eski parolini tasdiqlab o‘zgartiradi. Deaktivatsiya qilingan akkaunt kira olmaydi.

Bir brauzerning tablari umumiy kirish sessiyasidan foydalanadi. Boshqa tabda akkaunt almashsa yoki chiqish bajarilsa ochiq kabinetlar sessiyani tekshirib, yangi akkauntga mos yangilanadi. Shaxsiy kesh har sessiyada alohida; eski foydalanuvchining sarlavhasi va ma’lumotlari yangi foydalanuvchiga chiqarilmaydi.

## Lokal sun’iy akkauntlar

Lokal sinov paroli `.env.local` dagi `DEMO_PASSWORD` orqali o‘rnatiladi. U repozitoriyga yoki logga chiqarilmaydi. `seed_demo --students 100` sun’iy akkauntlarni tayyorlaydi; bu production uchun akkaunt yaratish usuli emas. Rahbar akkauntini haqiqiy muhitda yaratish buyruqlari README’da keltirilgan. Asosiy bazadagi 100 sun’iy o‘quvchi ushbu dizayn o‘zgarishlarida saqlanadi; brauzer testlari alohida bazada ishlaydi.
