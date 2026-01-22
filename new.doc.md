# 1Fin

# Loyihaning umumiy tavsifi

Bu tizim — kompaniya ichidagi bo‘limlar uchun chat, hujjat va fayl almashinuvi, statistik hisobotlar va kompaniya boshqaruvi imkoniyatlarini beruvchi veb / mobil ilova. Maqsad: xodimlar va klientlar o‘rtasida hujjat almashinuvi va ish jarayonlarini qulay, xavfsiz va boshqariladigan qilish.

# Asosiy bo‘limlar (Home menyu)

- Obshiy chat
- Bank oplata
- Dogovor
- Shot oplata
- Dovernost
- TTN
- Aktsverka
- HR (Kadrlar bo‘limi)
- Korxona ma’lumotlari

Har bir kompaniyada yuqoridagi bo‘limlar mavjud bo‘ladi. Ta’sischi yoki direktor kerakli bo‘limlarni sozlashi mumkin.

# Kompaniya ma’lumotlari

- Kompaniyaga oid barcha ma’lumotlar (rekvizitlar, INN, manzil, direktor, bank ma’lumotlari va hokazo) barcha xodimlar tomonidan ko‘rilishi, o‘qilishi, va nusxalab olinishi (copy) mumkin bo‘ladi.
- Kompaniya rasmiga faqat direktor yoki ma’sul xodim o‘zgartirish huquqiga ega.
- Kompaniya yaratishda so‘raladigan maydonlar:
    - Kompaniya nomi
    - INN
    - 1Fin (1Finga kerak bo‘ladigan) rasmi (yuklangan fayl sifatida saqlansin)
    - Rekvizitlar (bank, MFO, hisob raqam va hokazo)

**Namuna rekvizitlar:**

```
1FIN MCHJ AT
Адрес: Ракатбоши МФЙ, Урикзор кучаси, 7-уй
Р/с: 20208000805732587001
БАНК: АТ "АЛОКАБАНК"
банк адрес: ТОШКЕНТ Ш., АТ "АЛОКАБАНК" БОШ ОФИСИ
МФО: 00401
ИНН: 311006071
Директор: Кабилджанов Ж.Р

```

# Rollar va huquqlar

- **Ta’sischi (Founder):** bir nechta kompaniyalarga ega bo‘lishi mumkin. Home sahifasida uning barcha firmalari ko‘rinadi; firmani tanlab o‘tish uchun qaytadan login talab qilinmaydi.
- **Direktor / Ma’sul xodim (Admin):** kompaniya yaratish, xodim qo‘shish/o‘chirish, rollarni biriktirish, kompaniya rasmni o‘zgartirish.
- **Xodim (Employee):** bo‘limlarga tegishli fayllarni yuborish, qayta yo‘naltirish, chatda yozish, o‘z profili va ma’lumotlarini tahrirlash.
- **Client (Mijoz):** kompaniyaga fayl yoki xabar yuboradi; xodimlar undan kelgan faylni qabul yoki bekor qilishlari mumkin.

# Auth va xavfsizlik

- Kirish: Login (login + parol).
- Birinchi kirgach, foydalanuvchi o‘ziga ixtiyoriy parol o‘rnatishi mumkin.
- Biometrik autentifikatsiya (Face ID / Fingerprint) — foydalanuvchi xohlagan taqdirda yoqiladi.
- Rollar asosida API va UI foydalanuvchi huquqlari cheklanadi.

# Obshiy chat (Umumiy chat)

- Xabar yozish, rasm, fayl, video yuborish imkoniyati.
- Klientlardan kelgan fayllarni xodimlar bo‘limlar orasiga *forward* (pereslat) qilishi mumkin.
    - Forward qilishda hujjat **raqami** va qachon eslatma kelishi so‘ralishi kerak bo‘ladi (bu statistikaga bog‘lanadi).
- Xabarlarni o‘chirish: xodimlar xabarlarni o‘chira oladi, lekin ular chatdan to‘liq yo‘q bo‘lmaydi — xabar o‘chirildi deb *xiralashgan / markaziy* holatda qoladi (audit trail saqlansin).
- Fayl yuborishda file raqami ixtiyoriy, date ham.

# Bo‘limlar ichidagi chat (Har bir bo‘lim uchun)

- Har bir bo‘limda alohida kirim (incoming) va chiqim (outgoing) bo‘limlari bo‘ladi; UI’da bu ikki qism alohida ko‘rinadi.
- Client interfeysida esa kirim va chiqim bitta umumiy oqimda ko‘rsatiladi, lekin elementlar turiga qarab vizual farq bo‘ladi.
- Fayl yuborilganda xodimdan hujjat raqami va notification uchun date so‘raladi va shu raqam asosida statistikada hisoblanadi.
- Hodimni Chat tepasida `Settings` bo‘limi bo‘lib, u yerga qo‘l bilan o‘sha bo‘lim bo‘yicha bajarilgan ishlar soni kiritilishi mumkin — agar kiritilgan bo‘lsa statistikada shu qiymat asos qilib olinadi.

# Fayllarni qabul qilish / tasdiqlash (Xodim → Client)

- Xodimdan fayl kelganda Client interfeysida `Qabul qil` va `Qabul qilma` tugmalari ko‘rinadi.
- Agar client qaror qabul qilmasa — har kuni eslatma (notification) keladi.
- Qabul/Cancel kim tomonidan amalga oshirilgani qayd etiladi va ko‘rsatiladi.
- Agar xodim yuborgan faylga client javob bermasa, hodimga belgilangan sanada avtomatik eslatma kelishi kerak (masalan: “YYYY-MM-DD: bu file uchun client javob bermadi”).
- Fayl raqami ixtiyoriy bo‘lib qoldirilishi mumkin.

# Xabarlar va hujjatlarni oldingi bo‘limlarga forward qilish

- Forward jarayonida:
    - Kim yuborganligi (user id), forward qaysi bo‘limga qilinganligi va hujjat raqami saqlansin.
    - Forward paytida xodim hujjatga izoh qo‘ysa, izoh ham saqlansin.

# Statistikalar (faqat ta’sischi va direktor ko‘radi)

- Har bir bo‘lim uchun: nechta amal bajarilgan, nechta hujjat bilan ishlangan, nechta kirimlar va nechta chiqimlar bo‘lgan — barchasi umumiy dashboardga chiqarilsin.
- Statistikada chakana va umumiy ko‘rsatkichlar bo‘lsin (kunlik, haftalik, oylik).
- Agar chat tepasidagi `Settings` bo‘limida qo‘l bilan qiymat kiritilgan bo‘lsa, statistikada avval shu qo‘lda kiritilgan qiymat afzal ko‘rsatiladi.

# Bildirishnomalar (Notifications)

- Client → Xodim: file kelganda push/ichki bildirishnoma (notification) jo‘natilsin.
- Agar client qabul yoki rad qilmasa, har kuni eslatma kelishi kerak — bu eslatmalar xodimlar ham ko‘ra oladigan tartibda bo‘lsin.
- Qabul/Cancel qilinganida kim amalga oshirgani chatda log tariqasida ko‘rsatiladi.

# Qo‘shimcha talablarga e’tibor

- Direktor yoki ta’sischi yozgan xabarlar bazada alohida belgilanib, UI’da yulduzcha yoki boshqa vizual element bilan ko‘rsatiladi.
- Hamma xodimlar kompaniya ma’lumotlarini nusxalash (copy) qila olishlari kerak.
- Xodimlar o‘z ma’lumotlarini tahrirlash va kerak bo‘lsa o‘chirish imkoniga ega bo‘lishi kerak.
- Klient interfeysida xodimdan kelgan fayl uchun qabul qilishdan oldin tayyor old ko‘rinish (preview) bo‘lishi ma’qul.

# Qabul qilish mezonlari va testlar (qisqacha)

- Kompaniya yaratish: direktor yaratgach, kompaniya ma’lumotlari to‘liq ko‘rinishi va faqat direktor/ma’sul kompaniya rasmni o‘zgartira olishi.
- Fayl forward: forward qilinganida hujjat raqami talab qilinadi va statistikaga qo‘shiladi.
- Notification: hodimdan kelgan fayl uchun client bekor qilmaguncha yoki qabul qilmaguncha har kuni eslatma keladi.
- Chatdan xabar o‘chirganda u xiralashib qoladi va kim, qachon o‘chirgani ko‘rinadi.