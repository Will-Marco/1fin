# 1Fin - Backend API

Kompaniya ichidagi bo'limlar uchun chat, hujjat va fayl almashinuvi, statistik hisobotlar va kompaniya boshqaruvi platformasi.

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
| POST | `/files/upload` | Fayl yuklash (Company/Dept bog'langan) |
| GET | `/files/:id` | Fayl ma'lumotlari |
| DELETE | `/files/:id` | Soft-delete |

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

## License

MIT
