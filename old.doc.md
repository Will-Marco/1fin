# 1fin

# 1fin – Buxgalteriya va Boshqaruv Platformasi: Texnik Vazifa

## 1. Loyiha Haqida Umumiy Ma'lumot

**Loyiha nomi:** 1fin
**Maqsad:** Mijoz va buxgalteriya kompaniyasi o'rtasida shaffof, xavfsiz va nazorat qilinadigan muloqot tizimini yaratish. Telegram platformasidagi kamchiliklarni (nazorat yo'qligi, xabarlarni tahrirlash) bartaraf etish.

## 2. Biznes Logika (Mijoz va Rahbar uchun)

### 2.1. Mavzularga Bo'lingan Muloqot (Topic-based Chat)

Har bir mijoz bilan chat avtomatik ravishda quyidagi yo'nalishlarga ajratiladi:

- **Bank oplata:** Bank to'lovlari va kassa operatsiyalari.
- **Dogovor:** Kontragentlar bilan shartnomalar va huquqiy hujjatlar.
- **Shot-faktura:** Hisob-fakturalar, aktlar va yuk xatlari.
- **Dovernost:** Ishonchnomalar boshqaruvi.
- **TTN:** Transport vositalari uchun yuk xatlari.

### 2.2. Audit va Shaffoflik (Telegram muammosiga yechim)

- **Tahrirlash Cheklovi:** Xodim xabarni tahrirlasa yoki o'chirsa, tizimda "Asl nusxa" (Original) saqlanib qoladi.
- **Ghost-Mode:** Adminlar va Supervisorlar chatga qo'shilmasdan, real vaqtda muloqotni kuzata oladilar.
- **Mijoz Bahosi:** Har bir yopilgan mavzu bo'yicha mijoz xodim ishini baholaydi.

### 2.3. Xodimlar Managementi va KPI (Kelajakda)

- **Response Time:** Xabar kelgandan keyin javob berishgacha bo'lgan vaqt o'lchanadi.
- **Bonus Tizimi:** Xodimning oylik ish haqiga qo'shimcha bonuslar quyidagilar asosida hisoblanadi:
    - Qayta ishlangan hujjatlar soni.
    - Mijozlardan olingan ijobiy reyting.
    - SLA (belgilangan vaqt ichida javob berish) ko'rsatkichi.

---

## 3. Texnik Funksionallik (Backend Engineer uchun)

### 3.1. Ma'lumotlar Strukturasi (Core Architecture)

- **Message Versioning:** Har bir xabar uchun `versioning` tizimi. Tahrirlangan xabarlar bazada o'chirilmaydi, yangi versiya sifatida qo'shiladi.
- **RBAC (Role Based Access Control):**
    - **Admin:** Kompaniya egasi, hamma narsani ko'radi, loglarni eksport qiladi.
    - **Supervisor:** O'z bo'limidagi xodimlar va mijozlar chatini kuzatadi.
    - **Accountant (Xodim):** Faqat o'ziga biriktirilgan mijozlar bilan muloqot qiladi.
    - **Client:** Faqat o'z tashkilotiga oid ma'lumotlarni ko'radi.

### 3.2. Real-time va Media

- **WebSocket Integration:** Real-time chat, yozayotganlik holati (typing) va o'qilganlik statusi.
- **Document Management:** Fayllar `S3 Storage` (AWS/Minio) da saqlanadi.
- **Auto-Watermark:** Xodim tomonidan yuklangan hujjatlarga avtomatik tarzda kompaniya logotipi va yuklagan shaxs ID-si "watermark" sifatida bosiladi.

### 3.3. Xavfsizlik

- **Session Control:** Bir vaqtning o'zida bir nechta qurilmadan kirishni nazorat qilish.
- **Action Logs:** Tizimda kim, qachon, qaysi faylni yuklab olganini qayd etuvchi loglar.

---

## 4. Backend Texnologiyalar Steki (Taklif)

- **Core:** NestJS.
- **Database:** PostgreSQL (Hujjatlar va xabarlar tarixi uchun).
- **Real-time:** Socket.io
- **Storage:** AWS S3.
- **Background Tasks:** RabbitMQ (Fayllarni qayta ishlash va bildirishnomalar uchun).

---

## 5. Loyiha Bosqichlari (Roadmap)

1. **MVP:** Chat infratuzilmasi, 5 ta topik yaratish va fayl yuklash.
2. **Audit v1:** Xabarlar tarixini saqlash va Admin panel yaratish.
3. **KPI v1:** Statistikani yig'ish va bonuslarni hisoblash algoritmi.
4. **Security:** Watermarking va xavfsizlik cheklovlarini qo'shish.