# 1Fin Frontend API Yo'riqnomasi

Bu hujjat frontend dasturchilar uchun API endpointlari va WebSocket integratsiyasi bo'yicha to'liq yo'riqnoma.

## Mundarija

1. [Autentifikatsiya](#1-autentifikatsiya)
2. [Chat Module](#2-chat-module)
3. [Fayl Yuklash](#3-fayl-yuklash)
4. [WebSocket Integratsiya](#4-websocket-integratsiya)
5. [Xabar Turlari](#5-xabar-turlari)
6. [Namuna Kodlar](#6-namuna-kodlar)

---

## 1. Autentifikatsiya

### Login
```http
POST /auth/login
Content-Type: application/json

{
  "username": "ali.valiyev",
  "password": "password123"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-uuid",
    "username": "ali.valiyev",
    "name": "Ali Valiyev",
    "systemRole": "CLIENT_DIRECTOR",
    "memberships": [
      {
        "companyId": "company-uuid",
        "companyName": "Tech Solutions",
        "allowedDepartments": ["dept-1", "dept-2"]
      }
    ]
  }
}
```

### Token Yangilash
```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Har bir so'rovda Authorization Header
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 2. Chat Module

### 2.1. Xabarlar Ro'yxatini Olish

```http
GET /messages?companyId={companyId}&globalDepartmentId={deptId}&page=1&limit=50
Authorization: Bearer {token}
```

**Response:**
```json
{
  "data": [
    {
      "id": "msg-uuid",
      "content": "Salom, hammaga!",
      "type": "TEXT",
      "senderId": "user-uuid",
      "sender": {
        "id": "user-uuid",
        "name": "Ali Valiyev",
        "username": "ali.valiyev",
        "avatar": "https://...",
        "systemRole": "CLIENT_DIRECTOR"
      },
      "replyTo": null,
      "files": [],
      "isEdited": false,
      "isDeleted": false,
      "createdAt": "2024-03-08T10:00:00.000Z"
    }
  ],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 50,
    "totalPages": 3
  }
}
```

### 2.2. Oddiy Matnli Xabar Yuborish

```http
POST /messages
Authorization: Bearer {token}
Content-Type: application/json

{
  "companyId": "company-uuid",
  "globalDepartmentId": "dept-uuid",
  "content": "Salom, hammaga!",
  "type": "TEXT"
}
```

**Response:**
```json
{
  "id": "msg-uuid",
  "content": "Salom, hammaga!",
  "type": "TEXT",
  "senderId": "user-uuid",
  "sender": {
    "id": "user-uuid",
    "name": "Ali Valiyev",
    "username": "ali.valiyev"
  },
  "createdAt": "2024-03-08T10:00:00.000Z"
}
```

### 2.3. Reply Xabar Yuborish

```http
POST /messages
Authorization: Bearer {token}
Content-Type: application/json

{
  "companyId": "company-uuid",
  "globalDepartmentId": "dept-uuid",
  "content": "Ha, to'g'ri aytdingiz!",
  "type": "TEXT",
  "replyToId": "original-msg-uuid"
}
```

### 2.4. Xabarni Tahrirlash

```http
PATCH /messages/{messageId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "content": "Yangilangan xabar matni"
}
```

### 2.5. Xabarni O'chirish

```http
DELETE /messages/{messageId}
Authorization: Bearer {token}
```

---

## 3. Fayl Yuklash

### 3.1. Workflow A: Xabar bilan birga fayl (Tavsiya etiladi)

**1-qadam: Xabar yaratish**
```http
POST /messages
Authorization: Bearer {token}
Content-Type: application/json

{
  "companyId": "company-uuid",
  "globalDepartmentId": "dept-uuid",
  "content": "Mana hujjat",
  "type": "FILE"
}
```

**2-qadam: Faylni yuklash (messageId bilan)**
```http
POST /files/upload
Authorization: Bearer {token}
Content-Type: multipart/form-data

file: [binary data]
messageId: "msg-uuid"
globalDepartmentId: "dept-uuid"
```

### 3.2. Workflow B: Avval fayl, keyin xabar

**1-qadam: Faylni yuklash (messageId bo'lmasa)**
```http
POST /files/upload
Authorization: Bearer {token}
Content-Type: multipart/form-data

file: [binary data]
globalDepartmentId: "dept-uuid"
```

**Response:**
```json
{
  "id": "file-uuid",
  "originalName": "document.pdf",
  "fileName": "uuid-document.pdf",
  "fileSize": 1024000,
  "mimeType": "application/pdf",
  "fileType": "DOCUMENT",
  "url": "http://localhost:3000/uploads/documents/uuid-document.pdf"
}
```

**2-qadam: Xabar yaratish**
```http
POST /messages
Authorization: Bearer {token}
Content-Type: application/json

{
  "companyId": "company-uuid",
  "globalDepartmentId": "dept-uuid",
  "type": "FILE"
}
```

**3-qadam: Faylni xabarga biriktirish**
```http
PATCH /files/{fileId}/attach/{messageId}
Authorization: Bearer {token}
```

### 3.3. Ko'p Fayllarni Yuklash

```http
POST /files/upload-multiple
Authorization: Bearer {token}
Content-Type: multipart/form-data

files: [file1, file2, file3]
messageId: "msg-uuid"
globalDepartmentId: "dept-uuid"
```

### 3.4. Ko'p Fayllarni Biriktirish

```http
PATCH /files/attach-multiple/{messageId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "fileIds": ["file-1", "file-2", "file-3"]
}
```

### 3.5. Fayl O'lcham Limitlari

| Fayl Turi | Maksimum O'lcham |
|-----------|------------------|
| Rasm (IMAGE) | 5 MB |
| Hujjat (DOCUMENT) | 10 MB |
| Ovoz (VOICE) | 3 MB |
| Boshqa (OTHER) | 10 MB |

### 3.6. Ruxsat Berilgan MIME Turlari

**Rasmlar:**
- `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/svg+xml`

**Hujjatlar:**
- `application/pdf`
- `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- `text/plain`, `text/csv`

**Ovozlar:**
- `audio/mpeg`, `audio/wav`, `audio/ogg`, `audio/webm`, `audio/mp4`, `audio/aac`

---

## 4. WebSocket Integratsiya

### 4.1. Ulanish

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/chat', {
  auth: {
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  }
});
```

### 4.2. Bo'limga Qo'shilish

```javascript
// Bo'limga qo'shilish
socket.emit('join:department', {
  companyId: 'company-uuid',
  globalDepartmentId: 'dept-uuid'
});

// Muvaffaqiyatli qo'shilish
socket.on('joined:department', (data) => {
  console.log('Bo\'limga qo\'shildingiz:', data);
});

// Xatolik
socket.on('error', (error) => {
  console.error('Xatolik:', error.message);
});
```

### 4.3. Bo'limdan Chiqish

```javascript
socket.emit('leave:department', {
  companyId: 'company-uuid',
  globalDepartmentId: 'dept-uuid'
});

socket.on('left:department', (data) => {
  console.log('Bo\'limdan chiqdingiz:', data);
});
```

### 4.4. WebSocket Events (Server → Client)

| Event | Ma'lumot | Tavsif |
|-------|----------|--------|
| `message:new` | MessagePayload | Yangi xabar keldi |
| `message:edited` | EditPayload | Xabar tahrirlandi |
| `message:deleted` | { messageId } | Xabar o'chirildi |
| `user:online` | { userId, companyId, globalDepartmentId } | Foydalanuvchi online |
| `user:offline` | { userId } | Foydalanuvchi offline |
| `user:typing` | { userId, isTyping, ... } | Foydalanuvchi yozmoqda |
| `joined:department` | { companyId, globalDepartmentId } | Bo'limga qo'shildi |
| `left:department` | { companyId, globalDepartmentId } | Bo'limdan chiqdi |
| `error` | { message } | Xatolik yuz berdi |

### 4.5. WebSocket Events (Client → Server)

| Event | Ma'lumot | Tavsif |
|-------|----------|--------|
| `join:department` | { companyId, globalDepartmentId } | Bo'limga qo'shilish |
| `leave:department` | { companyId, globalDepartmentId } | Bo'limdan chiqish |
| `typing:start` | { companyId, globalDepartmentId } | Yozish boshlandi |
| `typing:stop` | { companyId, globalDepartmentId } | Yozish tugadi |

### 4.6. Event Payload Tuzilmalari

**message:new**
```typescript
interface MessagePayload {
  messageId: string;
  companyId: string;
  globalDepartmentId: string;
  senderId: string;
  content?: string;
  type: 'TEXT' | 'FILE' | 'VOICE' | 'DOCUMENT_FORWARD';
  replyToId?: string;
  createdAt: Date;
  sender: {
    id: string;
    username: string;
    name: string;
    avatar?: string;
  };
  files?: Array<{
    id: string;
    originalName: string;
    url: string;
    fileType: 'IMAGE' | 'DOCUMENT' | 'VOICE' | 'OTHER';
    fileSize: number;
  }>;
}
```

**message:edited**
```typescript
interface MessageEditPayload {
  messageId: string;
  companyId: string;
  globalDepartmentId: string;
  content: string;
  editedAt: Date;
}
```

**message:deleted**
```typescript
interface MessageDeletePayload {
  messageId: string;
}
```

**user:typing**
```typescript
interface TypingPayload {
  userId: string;
  companyId: string;
  globalDepartmentId: string;
  isTyping: boolean;
}
```

---

## 5. Xabar Turlari

### 5.1. TEXT - Oddiy Matn

```http
POST /messages
{
  "companyId": "...",
  "globalDepartmentId": "...",
  "content": "Salom!",
  "type": "TEXT"
}
```

### 5.2. FILE - Fayl bilan Xabar

```http
# 1. Xabar yaratish
POST /messages
{
  "companyId": "...",
  "globalDepartmentId": "...",
  "content": "Mana hujjat", // ixtiyoriy
  "type": "FILE"
}

# 2. Fayl yuklash
POST /files/upload
multipart/form-data:
  file: [binary]
  messageId: "{msg-id}"
```

### 5.3. VOICE - Ovozli Xabar

```http
# 1. Ovozni yozib olish (frontend)
# 2. Audio faylni yuklash
POST /files/upload
multipart/form-data:
  file: [audio blob]
  globalDepartmentId: "{dept-id}"

# 3. Xabar yaratish
POST /messages
{
  "companyId": "...",
  "globalDepartmentId": "...",
  "type": "VOICE",
  "voiceDuration": 45  // sekundlarda
}

# 4. Faylni biriktirish
PATCH /files/{fileId}/attach/{messageId}
```

**Yoki bitta so'rovda:**
```http
# 1. Xabar yaratish
POST /messages
{
  "companyId": "...",
  "globalDepartmentId": "...",
  "type": "VOICE",
  "voiceDuration": 45
}

# 2. Audio yuklash
POST /files/upload
multipart/form-data:
  file: [audio blob]
  messageId: "{msg-id}"
```

### 5.4. DOCUMENT_FORWARD - Hujjat Forward

Bu tur faqat 1FIN xodimlari tomonidan ishlatiladi.

```http
POST /messages/{messageId}/forward
{
  "toDepartmentId": "target-dept-uuid",
  "companyId": "company-uuid",
  "note": "Iltimos, ko'rib chiqing"
}
```

---

## 6. Namuna Kodlar

### 6.1. React + Socket.io Chat Hook

```typescript
// hooks/useChat.ts
import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface Message {
  id: string;
  content?: string;
  type: 'TEXT' | 'FILE' | 'VOICE';
  sender: { id: string; name: string; avatar?: string };
  files?: any[];
  createdAt: string;
}

export function useChat(companyId: string, deptId: string, token: string) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  useEffect(() => {
    // Socket ulanish
    const newSocket = io('http://localhost:3000/chat', {
      auth: { token }
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      // Bo'limga qo'shilish
      newSocket.emit('join:department', { companyId, globalDepartmentId: deptId });
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Yangi xabar
    newSocket.on('message:new', (message: Message) => {
      setMessages(prev => [...prev, message]);
    });

    // Xabar tahrirlandi
    newSocket.on('message:edited', (data) => {
      setMessages(prev => prev.map(msg =>
        msg.id === data.messageId
          ? { ...msg, content: data.content, isEdited: true }
          : msg
      ));
    });

    // Xabar o'chirildi
    newSocket.on('message:deleted', ({ messageId }) => {
      setMessages(prev => prev.map(msg =>
        msg.id === messageId
          ? { ...msg, isDeleted: true, content: 'Bu xabar o\'chirilgan' }
          : msg
      ));
    });

    // Typing indikator
    newSocket.on('user:typing', ({ userId, isTyping }) => {
      setTypingUsers(prev => {
        if (isTyping && !prev.includes(userId)) {
          return [...prev, userId];
        }
        if (!isTyping) {
          return prev.filter(id => id !== userId);
        }
        return prev;
      });
    });

    setSocket(newSocket);

    return () => {
      newSocket.emit('leave:department', { companyId, globalDepartmentId: deptId });
      newSocket.disconnect();
    };
  }, [companyId, deptId, token]);

  // Typing emit
  const startTyping = useCallback(() => {
    socket?.emit('typing:start', { companyId, globalDepartmentId: deptId });
  }, [socket, companyId, deptId]);

  const stopTyping = useCallback(() => {
    socket?.emit('typing:stop', { companyId, globalDepartmentId: deptId });
  }, [socket, companyId, deptId]);

  return {
    messages,
    isConnected,
    typingUsers,
    startTyping,
    stopTyping
  };
}
```

### 6.2. Fayl Yuklash Service

```typescript
// services/fileService.ts
const API_URL = 'http://localhost:3000';

export async function uploadFile(
  file: File,
  options: {
    messageId?: string;
    documentId?: string;
    globalDepartmentId?: string;
  },
  token: string
) {
  const formData = new FormData();
  formData.append('file', file);

  if (options.messageId) formData.append('messageId', options.messageId);
  if (options.documentId) formData.append('documentId', options.documentId);
  if (options.globalDepartmentId) formData.append('globalDepartmentId', options.globalDepartmentId);

  const response = await fetch(`${API_URL}/files/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  return response.json();
}

export async function uploadMultipleFiles(
  files: File[],
  options: {
    messageId?: string;
    globalDepartmentId?: string;
  },
  token: string
) {
  const formData = new FormData();

  files.forEach(file => {
    formData.append('files', file);
  });

  if (options.messageId) formData.append('messageId', options.messageId);
  if (options.globalDepartmentId) formData.append('globalDepartmentId', options.globalDepartmentId);

  const response = await fetch(`${API_URL}/files/upload-multiple`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  return response.json();
}

export async function attachFileToMessage(
  fileId: string,
  messageId: string,
  token: string
) {
  const response = await fetch(`${API_URL}/files/${fileId}/attach/${messageId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  return response.json();
}
```

### 6.3. Ovozli Xabar Yozib Olish

```typescript
// hooks/useVoiceRecorder.ts
import { useState, useRef } from 'react';

export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      chunks.current = [];

      mediaRecorder.current.ondataavailable = (e) => {
        chunks.current.push(e.data);
      };

      mediaRecorder.current.start();
      setIsRecording(true);
      setDuration(0);

      // Vaqtni hisoblash
      intervalRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Mikrofonga kirish imkoni yo\'q:', error);
    }
  };

  const stopRecording = (): Promise<{ blob: Blob; duration: number }> => {
    return new Promise((resolve) => {
      if (!mediaRecorder.current) return;

      mediaRecorder.current.onstop = () => {
        const blob = new Blob(chunks.current, { type: 'audio/webm' });
        setIsRecording(false);

        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }

        resolve({ blob, duration });
      };

      mediaRecorder.current.stop();
      mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
    });
  };

  return {
    isRecording,
    duration,
    startRecording,
    stopRecording,
  };
}
```

### 6.4. Ovozli Xabar Yuborish

```typescript
// components/VoiceMessageButton.tsx
async function sendVoiceMessage(
  companyId: string,
  globalDepartmentId: string,
  token: string
) {
  const { blob, duration } = await stopRecording();

  // 1. Xabar yaratish
  const messageRes = await fetch('/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      companyId,
      globalDepartmentId,
      type: 'VOICE',
      voiceDuration: duration,
    }),
  });
  const message = await messageRes.json();

  // 2. Audio faylni yuklash
  const formData = new FormData();
  formData.append('file', blob, 'voice-message.webm');
  formData.append('messageId', message.id);
  formData.append('globalDepartmentId', globalDepartmentId);

  await fetch('/files/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });
}
```

---

## 7. Xatolik Kodlari

| HTTP Status | Xatolik | Tavsif |
|-------------|---------|--------|
| 400 | Bad Request | Noto'g'ri so'rov parametrlari |
| 401 | Unauthorized | Token yo'q yoki noto'g'ri |
| 403 | Forbidden | Ruxsat yo'q |
| 404 | Not Found | Resurs topilmadi |
| 413 | Payload Too Large | Fayl juda katta |
| 422 | Unprocessable Entity | Validatsiya xatosi |
| 500 | Internal Server Error | Server xatosi |

**Xatolik Response Formati:**
```json
{
  "statusCode": 400,
  "message": "Fayl hajmi 10MB dan oshmasligi kerak",
  "error": "Bad Request"
}
```

---

## 8. Muhim Eslatmalar

1. **Token muddati:** Access token 15 daqiqa, Refresh token 7 kun amal qiladi
2. **WebSocket reconnect:** Ulanish uzilganda avtomatik qayta ulanish qo'shing
3. **Fayl yuklash progress:** XMLHttpRequest yoki axios bilan progress tracking qiling
4. **Typing debounce:** `typing:start` ni 500ms debounce bilan chaqiring
5. **Offline support:** Xabarlarni local storage da saqlang va sync qiling
6. **Pagination:** Xabarlarni infinite scroll bilan yuklang (eng yangisi pastda)

---

## 9. Test Credentials (Development)

```
Admin:
  username: admin
  password: admin123

Client Director:
  username: director
  password: director123
```

---

**Savol va takliflar uchun:** backend@1fin.uz
