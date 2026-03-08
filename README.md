# 1Fin - Backend API

Kompaniya ichidagi bo'limlar uchun chat, hujjat va fayl almashinuvi, statistik hisobotlar va kompaniya boshqaruvi platformasi.

## 📋 So'nggi Yangilanishlar

### v1.1.0 (2026-03-08)

#### 🐛 Tuzatilgan Xatolar
- **File Upload Foreign Key Constraint**: File yuklashda `messageId`, `documentId`, va `globalDepartmentId` uchun validatsiya qo'shildi. Endi mavjud bo'lmagan ID lar bilan fayl yuklanmaydi va aniq xatolik xabari qaytadi.

#### ✨ Yangi Funksiyalar
- **Fayl Biriktirish API**: Fayllarni avval yuklash, keyin xabarga biriktirish imkoniyati qo'shildi
  - `PATCH /files/:fileId/attach/:messageId` - Bitta faylni biriktirish
  - `PATCH /files/attach-multiple/:messageId` - Ko'p fayllarni biriktirish
- **Ikki Xil Upload Workflow**: Xabarni avval yoki faylni avval yaratish imkoniyati
- **Xavfsizlik**: Faqat fayl egasi o'z faylini, faqat xabar egasi o'z xabariga fayl biriktirishi mumkin

#### 🧪 Testlar
- File service uchun 9 ta yangi test qo'shildi
- Validatsiya va attach funksiyalari uchun to'liq test coverage

---

## Tech Stack

| Texnologiya | Vazifasi |
|-------------|----------|
| NestJS | Backend framework |
| PostgreSQL | Database |
| Prisma | ORM |
| Socket.io | Real-time WebSocket |
| RabbitMQ | Message queue |
| AWS S3 / Local | File storage |
| OneSignal | Push notifications |
| JWT | Authentication |

## Quick Start

```bash
# Install dependencies
npm install

# Setup database
npx prisma migrate dev

# Run development
npm run start:dev

# Run tests
npm run test
```

## Environment Variables

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/fin_db"

# JWT
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="7d"

# File Storage
STORAGE_TYPE="local"  # or "s3"
UPLOAD_DIR="./uploads"

# RabbitMQ
RABBITMQ_URL="amqp://localhost:5672"
```

## Architecture Overview

Loyiha **Multi-Tenant** modelida qurilgan. Foydalanuvchilar ikki turga bo'linadi:
1. **System Staff (1FIN xodimlari)**: Butun tizimni boshqaradi.
2. **Client Users (Mijozlar)**: Bir yoki bir nechta kompaniya a'zosi bo'lishi mumkin.

## Roles & Permissions

### System Roles (1FIN xodimlari uchun)
| Role | Description |
|------|-------------|
| `FIN_DIRECTOR` | Tizim rahbari - barcha huquqlarga ega |
| `FIN_ADMIN` | Tizim admini - kompaniya va userlarni boshqaradi |
| `FIN_EMPLOYEE` | Tizim xodimi - operatsion vazifalar |

### Company Roles (Mijozlar uchun)
| Role | Description |
|------|-------------|
| `CLIENT_FOUNDER` | Kompaniya ta'sischisi |
| `CLIENT_DIRECTOR` | Kompaniya direktori |
| `CLIENT_EMPLOYEE` | Kompaniya xodimi |

## API Modules

### Auth Module
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Tizimga kirish |
| POST | `/auth/refresh` | Token yangilash |
| POST | `/auth/logout` | Chiqish |
| GET | `/auth/me` | Joriy profil |

### Users Module
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/users/system` | 1FIN xodimini yaratish |
| POST | `/users/client` | Mijoz foydalanuvchisini yaratish |
| GET | `/users` | Foydalanuvchilar ro'yxati |
| PATCH | `/users/:id` | Ma'lumotlarni yangilash |
| POST | `/users/:id/memberships`| Foydalanuvchini kompaniyaga qo'shish |
| PATCH | `/users/:id/memberships/:mId`| Kompaniya roli yoki bo'lim accessini o'zgartirish |

### Companies Module
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/companies` | Kompaniya yaratish |
| GET | `/companies` | Kompaniyalar ro'yxati |
| GET | `/companies/:id` | Kompaniya ma'lumotlari |
| POST | `/companies/:id/departments/:deptId/enable`| Bo'limni aktivlashtirish |

### Global Departments Module
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/global-departments` | Barcha tizim bo'limlari |
| POST | `/global-departments` | Yangi tizim bo'limi yaratish |

### Messages & Documents Module
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/messages` | Xabar yuborish |
| GET | `/messages` | Xabarlar tarixi |
| POST | `/documents` | Hujjat yaratish (PENDING) |
| PATCH | `/documents/:id/approve`| Hujjatni qabul qilish |
| PATCH | `/documents/:id/reject` | Hujjatni rad etish |

### Files Module
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/files/upload` | Fayl yuklash (messageId/documentId/departmentId bilan) |
| POST | `/files/upload-multiple` | Bir nechta fayllarni yuklash (max 10 ta) |
| GET | `/files/:id` | Fayl ma'lumotlari |
| GET | `/files/department/:departmentId` | Bo'lim fayllarini olish |
| PATCH | `/files/:fileId/attach/:messageId` | Faylni xabarga biriktirish |
| PATCH | `/files/attach-multiple/:messageId` | Ko'p fayllarni xabarga biriktirish |
| DELETE | `/files/:id` | Soft-delete |
| PATCH | `/files/:id/restore` | Faylni tiklash (Admin only) |
| DELETE | `/files/:id/permanent` | Butunlay o'chirish (Admin only) |

#### File Upload Workflows

**Variant A: Xabarni avval yaratish (Tavsiya etiladi)**
```bash
# 1. Xabar yaratish
POST /messages
Response: { id: "msg-123", ... }

# 2. Fayllarni xabarga biriktirish
POST /files/upload
Body: { messageId: "msg-123", file: ... }
```

**Variant B: Faylni avval yuklash**
```bash
# 1. Faylni yuklash (messageId bo'lmasa)
POST /files/upload
Body: { file: ... }
Response: { id: "file-456", ... }

# 2. Xabar yaratish
POST /messages
Response: { id: "msg-123", ... }

# 3. Faylni xabarga biriktirish
PATCH /files/file-456/attach/msg-123
```

#### File Size Limits
- **Rasm**: 5MB
- **Hujjat**: 10MB
- **Ovoz**: 3MB
- **Boshqa**: 10MB

## WebSocket Events

### Connection & Rooms
WebSocket ulanishi JWT orqali amalga oshiriladi. Har bir foydalanuvchi quyidagi xonalarga avtomatik ulanadi:
- `company:{companyId}:dept:{globalDepartmentId}`

### Events Table
| Event | Direction | Description |
|-------|-----------|-------------|
| `message:new` | Server -> Client | Yangi xabar keldi |
| `message:edited` | Server -> Client | Xabar tahrirlandi |
| `message:deleted` | Server -> Client | Xabar o'chirildi |
| `document:status` | Server -> Client | Hujjat holati o'zgardi |

## Document Status Flow

```mermaid
graph TD
    PENDING --> ACCEPTED
    PENDING --> REJECTED
    PENDING --> AUTO_EXPIRED(10 kundan keyin)
```

## Cron Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| Document Reminder | Har kuni 09:00 | PENDING hujjatlar haqida eslatma |
| Document Expiry | Har kuni yarim tunda | Muddati o'tgan hujjatlarni yopish |
| Archive Old Data | Tun yarmida | 3 oylik ma'lumotlarni arxivlash |

## Project Structure

```
src/
├── auth/           # Authentication & Session management
├── users/          # Users & System/Company Memberships
├── companies/      # Multi-tenant Company management
├── departments/    # Global Departments definitions
├── messages/       # Real-time Messages & Documents
├── files/          # File storage & access control
├── queues/         # RabbitMQ consumers/producers
├── jobs/           # Scheduled tasks
├── common/         # SystemRole/CompanyRole guards & decorators
└── database/       # Prisma service & configs
```