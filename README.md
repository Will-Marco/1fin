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

# S3 (optional)
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
AWS_S3_BUCKET=""
AWS_S3_REGION=""

# RabbitMQ
RABBITMQ_URL="amqp://localhost:5672"

# OneSignal
ONESIGNAL_APP_ID=""
ONESIGNAL_API_KEY=""
```

## API Modules

### Auth Module
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Ro'yxatdan o'tish |
| POST | `/auth/login` | Tizimga kirish |
| POST | `/auth/refresh` | Token yangilash |
| POST | `/auth/logout` | Chiqish |
| GET | `/auth/me` | Joriy foydalanuvchi |
| GET | `/auth/sessions` | Aktiv sessiyalar |
| DELETE | `/auth/sessions/:id` | Sessiyani o'chirish |

### Users Module
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users` | Barcha foydalanuvchilar |
| GET | `/users/:id` | Foydalanuvchi ma'lumotlari |
| PATCH | `/users/:id` | Ma'lumotlarni yangilash |
| DELETE | `/users/:id` | Foydalanuvchini o'chirish |
| PATCH | `/users/:id/password` | Parolni o'zgartirish |

### Companies Module

#### UserCompany (Mijoz kompaniyasi)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/user-companies` | Kompaniya yaratish |
| GET | `/user-companies` | Kompaniyalar ro'yxati |
| GET | `/user-companies/:id` | Kompaniya ma'lumotlari |
| PATCH | `/user-companies/:id` | Yangilash |
| DELETE | `/user-companies/:id` | O'chirish |

#### OperatorCompany (Operator kompaniyasi)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/operator-companies` | Operator yaratish |
| GET | `/operator-companies` | Operatorlar ro'yxati |
| GET | `/operator-companies/:id` | Operator ma'lumotlari |
| PATCH | `/operator-companies/:id` | Yangilash |
| DELETE | `/operator-companies/:id` | O'chirish |

### Departments Module
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/departments` | Bo'lim yaratish |
| GET | `/departments` | Bo'limlar ro'yxati |
| GET | `/departments/:id` | Bo'lim ma'lumotlari |
| PATCH | `/departments/:id` | Yangilash |
| DELETE | `/departments/:id` | O'chirish |
| POST | `/departments/:id/members` | A'zo qo'shish |
| DELETE | `/departments/:id/members/:userId` | A'zoni o'chirish |

### Messages Module
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/messages` | Xabar yuborish |
| GET | `/messages` | Xabarlar ro'yxati |
| GET | `/messages/:id` | Xabar ma'lumotlari |
| PATCH | `/messages/:id` | Xabarni tahrirlash |
| DELETE | `/messages/:id` | Xabarni o'chirish (soft) |
| POST | `/messages/:id/reply` | Javob berish |
| POST | `/messages/:id/forward` | Forward qilish |
| PATCH | `/messages/:id/document-status` | Hujjat holatini o'zgartirish |

### Files Module
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/files/upload` | Fayl yuklash |
| POST | `/files/upload-multiple` | Ko'p fayl yuklash |
| GET | `/files/:id` | Fayl ma'lumotlari |
| GET | `/files/:id/download` | Faylni yuklab olish |
| DELETE | `/files/:id` | Faylni o'chirish |

### Notifications Module
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/notifications` | Bildirishnomalar |
| PATCH | `/notifications/:id/read` | O'qilgan deb belgilash |
| PATCH | `/notifications/read-all` | Hammasini o'qish |

### Archive Module
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/archive/messages` | Arxivlangan xabarlar |
| GET | `/archive/files` | Arxivlangan fayllar |
| POST | `/archive/run` | Manual arxivlash (Admin) |

## WebSocket Events

### Connection
```javascript
// Connect with JWT token
const socket = io('ws://localhost:3000', {
  auth: { token: 'your-jwt-token' }
});
```

### Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `join:department` | Client -> Server | Bo'limga ulanish |
| `leave:department` | Client -> Server | Bo'limdan chiqish |
| `typing:start` | Client -> Server | Yozishni boshlash |
| `typing:stop` | Client -> Server | Yozishni to'xtatish |
| `message:new` | Server -> Client | Yangi xabar |
| `message:edited` | Server -> Client | Tahrirlangan xabar |
| `message:deleted` | Server -> Client | O'chirilgan xabar |
| `document:status` | Server -> Client | Hujjat holati o'zgarishi |
| `user:online` | Server -> Client | User online bo'ldi |
| `user:offline` | Server -> Client | User offline bo'ldi |
| `typing` | Server -> Client | Kimdir yozmoqda |

### Example Usage
```javascript
// Join department
socket.emit('join:department', { departmentId: 'uuid' });

// Listen for new messages
socket.on('message:new', (message) => {
  console.log('New message:', message);
});

// Typing indicator
socket.emit('typing:start', { departmentId: 'uuid' });
socket.emit('typing:stop', { departmentId: 'uuid' });
```

## Roles & Permissions

| Role | Description |
|------|-------------|
| `SUPER_ADMIN` | Tizim administratori |
| `FOUNDER` | Ta'sischi - barcha kompaniyalarni ko'radi |
| `DIRECTOR` | Direktor - kompaniya egasi |
| `ADMIN` | Admin - kompaniya boshqaruvchisi |
| `EMPLOYEE` | Xodim - bo'limlarda ishlaydi |
| `CLIENT` | Mijoz - faqat o'z ma'lumotlarini ko'radi |

## Document Status Flow

```
PENDING -> ACCEPTED (Qabul qilindi)
PENDING -> REJECTED (Rad etildi)
```

## Cron Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| Document Reminder | Har kuni 09:00 | Javob berilmagan hujjatlar uchun eslatma |
| Archive Old Data | Har oy 1-kuni | 3 oylik ma'lumotlarni arxivlash |

## Project Structure

```
src/
├── auth/           # Authentication module
├── users/          # Users management
├── companies/      # UserCompany & OperatorCompany
├── departments/    # Departments & members
├── messages/       # Messages, reply, forward
├── files/          # File upload/download
├── notifications/  # Push notifications
├── queues/         # RabbitMQ consumers
├── jobs/           # Cron jobs
├── archive/        # Data archiving
├── prisma/         # Database schema & migrations
└── common/         # Shared utilities, guards, decorators
```

## Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## Production Deployment

```bash
# Build
npm run build

# Run migrations
npx prisma migrate deploy

# Start production
npm run start:prod
```

## Docker

```bash
# Build image
docker build -t 1fin-api .

# Run with docker-compose
docker-compose up -d
```

## License

MIT
