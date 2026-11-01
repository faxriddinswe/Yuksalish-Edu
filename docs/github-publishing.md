# GitHub’ga yuklash va maxfiylik

Repozitoriy public: `https://github.com/faxriddinswe/Yuksalish-Edu`. Loyiha WIP, reliz hali tayyor emas. Public kodni hamma ko‘rishi mumkin; maxfiy ma’lumotlar undan alohida saqlanadi.

## Yuklanadigan fayllar

Backend/frontend manba kodi, migratsiyalar, dependency lock fayllari, sun’iy testlar, loyiha ikonkalari, Docker/Nginx konfiguratsiyasi, CI va umumiy yo‘riqnomalar. `.env.example` va `.env.production.example` ichidagi maxfiy qiymatlar bo‘sh.

## Faqat lokalda qoladigan fayllar

- `.env`, `.env.local`, `.env.production`, credential va kalit/sertifikat fayllari.
- Baza dumpi/SQLite, backup arxivlari, Excel/CSV eksportlari.
- `backend/media/`, `backend/private_exports/`, foydalanuvchi yuklagan rasmlar.
- `certificates/` ichidagi asl suratlar va fanlarning shaxsiy `certificates.json` fayllari. Faqat yo‘riqnoma, bo‘sh papkalar va anonim `.example.json` shabloni versiyalanadi.
- `.local/`, dependency/build/kesh papkalari, loglar va generatsiya qilingan Next.js turlari.
- Lokal JSON/XML test hisobotlari, skrinshotlar va bazaning xeshlari. Batafsil lokal `docs/implementation-status.md` o‘z joyida saqlanadi; public holat `docs/project-status.md` da.

`.gitignore` versiyalashni, `.dockerignore` build kontekstini cheklaydi. `.gitignore` oldindan commit qilingan faylni yashirmaydi va uni `git add -f` bilan chetlab o‘tish mumkin. Shuning uchun har yuklash oldidan haqiqiy fayllar to‘plami tekshiriladi:

```bash
python3 scripts/check-public-files
git status --short
git diff --cached --stat
```

Tekshiruvchi Git’dagi mavjud/staged va yangi yuklanadigan fayllarni tekshiradi: ignore qilinishi kerak bo‘lgan tracked fayllar, private key/token namunalari, credential URL, lokal `.env` maxfiy qiymatlarining nusxalari, symlink va noma’lum binary fayllar. Mos kelgan maxfiy qiymat logga chiqarilmaydi. Bu tekshiruv CI’da ham bajariladi; inson ko‘rib chiqishini almashtirmaydi.

Yangi maxfiy fayl turi paydo bo‘lsa ignore qoidalarini ham yangilang. Maxfiy qiymat adashib GitHub’ga chiqsa, uni faqat o‘chirish yetarli emas: credentialni almashtirish va Git tarixini alohida tozalash kerak.

Yangi klondagi `npm run typecheck --prefix frontend` avval `next typegen` bajaradi. Shuning uchun lokal build fayllarini GitHub’ga yuklash talab qilinmaydi. Yangi klon ishchi markaz ma’lumotlarini yoki asl sertifikat rasmlarini avtomatik tiklamaydi; ular alohida xavfsiz backupdan olinadi.
