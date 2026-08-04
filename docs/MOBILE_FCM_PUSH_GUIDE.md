# 1Fin — FCM Push & Device Registration (to'liq)

> Auditoriya: **one_fin** (Flutter) developer.
> Backend: `main`. Bu hujjat **faqat FCM push va device token** qismini qamraydi.
> WebSocket / read-sync uchun → `MOBILE_NOTIFICATIONS_GUIDE.md`.
> Base: `https://jr-techno.uz/api/v1`, `Authorization: Bearer <accessToken>`.

---

## 0. Tez javob — "notification kelmay qoldi" bo'lsa

Oxirgi backend o'zgarishidan keyin push **quyidagi hollarda ATAYLAB yuborilmaydi.**
Avval shularni tekshiring (batafsil §6 va §7):

1. **User o'sha chat bo'limida AKTIV** (socket room'ida) — o'sha bo'lim xabari uchun
   push yuborilmaydi (chunki u chatni ochib ko'rib turibdi). ⚠️ **Eng ko'p uchraydigan
   sabab:** mobile socket'ni **background'da ham** ulangan/room'da qoldirsa, backend
   uni "aktiv ko'ryapti" deb hisoblab push'ni bostiradi. → §7.1
2. **Active FCM token yo'q** (register qilinmagan yoki eskirib deactivate bo'lgan). → §7.3
3. **`notificationsEnabled = false`** (foydalanuvchi push'ni o'chirgan). → §6
4. **iOS:** Firebase Console'da APNs `.p8` key yo'q. → §7.5

> **Muhim:** faqat **yangi chat xabari** push'i aktiv-bo'lim bo'yicha bostiriladi.
> Hujjat eslatmalari (document reminder) doim yuboriladi.

---

## 1. Umumiy oqim — push qayerdan chiqadi

```
Yangi xabar / hujjat eslatmasi
      │
      ▼
RabbitMQ (notifications.push)
      │
      ▼
NotificationConsumer  ──►  In-app notification (DB)  ──►  socket: notification:new
      │
      └──►  FirebaseService.sendPush(userId)  ──►  FCM  ──►  qurilma banner + badge
```

- **In-app** (app ichidagi ro'yxat/socket) va **FCM** (native banner) — ikki alohida
  kanal, ikkovi ham shu bitta oqimdan chiqadi.
- Shuning uchun "app ichida ishlaydi, lekin FCM kelmaydi" degani — oqim to'g'ri,
  muammo **FCM tomonida** (token yoki suppression). §6/§7.

---

## 2. Device token registratsiyasi — `POST /notifications/devices`

Push kelishi uchun qurilmaning **FCM token**i backendda ro'yxatdan o'tishi shart.

**So'rov:**
```
POST /api/v1/notifications/devices
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "fcmToken": "<FCM token>", "platform": "ANDROID" }
```
- `platform`: `ANDROID` | `IOS` | `WEB` (aynan shu qiymatlar, katta harf).
- `fcmToken`: bo'sh bo'lmasligi shart.

**Javob `201`:**
```json
{ "id": "...", "fcmToken": "...", "platform": "ANDROID", "isActive": true, "lastSeenAt": "..." }
```

**Upsert mantiqi:** token global unikal. Agar token ilgari boshqa userga tegishli
bo'lsa (bir qurilma, boshqa akkaunt), joriy userga qayta biriktiriladi va `isActive=true`
qilinadi.

### 2.1 QACHON register qilish (muhim)

- **Login muvaffaqiyatli bo'lgach** + FCM token olgach → register.
- **FCM `onTokenRefresh`** — token yangilanganda **qayta register**. Bu majburiy:
  token vaqti-vaqti bilan almashadi; qayta register qilinmasa eski token deactivate
  bo'ladi va push to'xtaydi.
- **App qayta ochilganda** (token o'zgargan bo'lishi mumkin) — register (yoki
  `lastSeenAt` yangilanishi uchun).

```dart
// login'dan keyin
final token = await FirebaseMessaging.instance.getToken();
if (token != null) await registerDevice(token, platform); // POST /notifications/devices

// token yangilanganda
FirebaseMessaging.instance.onTokenRefresh.listen((t) => registerDevice(t, platform));
```

---

## 3. Unregister (logout) — `DELETE /notifications/devices`

Logout'da tokenni deaktivatsiya qiling (aks holda boshqa akkaunt push'ini oladi):

**Tavsiya (body'da):**
```
DELETE /api/v1/notifications/devices
Body: { "fcmToken": "<token>" }
```
**Legacy (URL'da, hozir ham ishlaydi):**
```
DELETE /api/v1/notifications/devices/<URL-encoded-token>
```
Javob: `{ "unregistered": 1 }`.

> Logout'da `FirebaseMessaging.instance.deleteToken()` ham chaqiring — keyingi
> login'da yangi token olinadi va qayta register qilinadi.

---

## 4. Ro'yxatni tekshirish — `GET /notifications/devices`

Token backendda ro'yxatda va aktivligini tekshirish uchun (debug uchun juda foydali):
```
GET /api/v1/notifications/devices
→ { "data": [ { "fcmToken": "...", "platform": "ANDROID", "isActive": true, "lastSeenAt": "..." } ], "meta": { "total": 1 } }
```
Push kelmasa — **birinchi shu bilan tekshiring:** token ro'yxatda bormi va `isActive: true` mi?

---

## 5. Push payload strukturasi (backend nima yuboradi)

```jsonc
{
  "notification": { "title": "...", "body": "..." },
  "data": {
    "type": "NEW_MESSAGE",          // yoki DOCUMENT_REMINDER, ...
    "companyId": "...",
    "globalDepartmentId": "...",
    "messageId": "...",
    "title": "...",                  // title/body data'ga ham nusxalanadi (background handler uchun)
    "body": "...",
    "unreadCount": "7"               // badge (string)
  },
  "android": { "priority": "high", "notification": { "notificationCount": 7 } },
  "apns": { "payload": { "aps": { "sound": "default", "badge": 7 } } }
}
```

- **Badge:** iOS `aps.badge` — OS avtomatik app-icon'ga qo'yadi. Android — `data.unreadCount`
  ni o'qib o'zingiz qo'ying (masalan `flutter_app_badger`).
- **Bo'sh banner** oldini olish: background handler'da banner'ni `data.title`/`data.body`
  dan quring (ba'zi holatlarda `notification` bloki background'da to'liq kelmaydi).

---

## 6. Push QAYSI HOLDA yuborilmaydi (backend mantiqi)

`sendPush` quyidagi 4 sharttan biri bo'lsa **jimgina** push yubormaydi:

| # | Shart | Izoh |
|---|---|---|
| 1 | Firebase init bo'lmagan | Server credential yo'q (ops masalasi). |
| 2 | User'da active token yo'q | `deviceToken.isActive=true` yo'q — register qilinmagan yoki deactivate bo'lgan. |
| 3 | `user.notificationsEnabled = false` | Foydalanuvchi push'ni o'chirgan (in-app qoladi, FCM yo'q). |
| 4 | **User o'sha bo'lim chatida AKTIV** | `/chat` socket room'ida bo'lsa — o'sha bo'lim xabari uchun push YO'Q. (Faqat yangi chat xabari; document reminder emas.) |

**Token cleanup:** FCM `invalid-argument` / `registration-token-not-registered` /
`invalid-registration-token` qaytarsa, backend o'sha tokenni **avtomatik deactivate**
qiladi. Ya'ni eskirgan token qayta register qilinmasa — o'chib qoladi (shuning uchun
§2.1 dagi `onTokenRefresh` register majburiy).

---

## 7. Troubleshooting — "MD dan keyin notif kelmay qoldi"

Ehtimollik bo'yicha tartiblangan:

### 7.1 ⭐ Chat socket background'da room'da qolgan (eng ehtimoliy)
Oxirgi backend o'zgarishi: user `/chat` bo'lim room'ida **aktiv** bo'lsa, o'sha
bo'limga kelgan xabar uchun FCM **yuborilmaydi** (u chatni ochib turibdi deb hisoblanadi).

**Muammo:** agar mobile chat socket'ni **background/app yopiq**da ham ulangan va
`join:department` qilingan holda qoldirsa — backend uni "aktiv" deb ko'radi va push'ni
bostiradi. Test paytida chatni ochiq qoldirib push kutish ham shu.

**Yechim (mobile):**
- Bo'lim ekranidan chiqqanda **`leave:department`** emit qiling.
- App background'ga o'tганda chat socketни **disconnect** qiling (yoki room'dan chiqing).
- Ya'ni room'ga faqat ekran **haqiqatan ochiq** bo'lganда qo'shiling.

Backend "aktiv"ni socket room a'zoligidan biladi — screen focus'ni bilmaydi. Shuning
uchun room a'zoligini ekran holatiga moslashtiring.

### 7.2 Foreground banner butunlay bostirilgan
`MOBILE_NOTIFICATIONS_GUIDE`da "foreground'da FCM banner + socket banner dublikat
bo'lmasin" deyilgan. Agar FCM display'ni **umuman** o'chirib qo'ygan bo'lsangiz,
background/yopiq holatda ham banner chiqmaydi.
**Yechim:** faqat **foreground**da (app ochiq va socket bor) FCM banner'ni bostiring;
background/terminated'da FCM o'z ishini qilsin.

### 7.3 Token register qilinmagan / refresh'da yangilanmagan
- `GET /notifications/devices` bilan tekshiring — token bormi, `isActive:true` mi?
- Yo'q bo'lsa: login'dan keyin register chaqirilmayapti yoki `onTokenRefresh`da qayta
  register yo'q. §2.1.
- Reinstall / `deleteToken()` dan keyin yangi token register qilinishi shart.

### 7.4 `notificationsEnabled = false`
Foydalanuvchi sozlamada push'ni o'chirган bo'lishi mumkin. Bu holda in-app keladi,
FCM kelmaydi.

### 7.5 iOS'da umuman kelmasa
Firebase Console → Cloud Messaging → **APNs Authentication Key (.p8)** yuklangan
bo'lishi shart. Bu backend emas, Firebase Console masalasi.

### 7.6 Diagnostika uchun
- Backend logida push urinishi ko'rinadi: `FCM token failed [<code>] ...` yoki
  `No active FCM tokens for user ...`. Mobile dev backend logini so'rasa — shu kodlar
  aniq sababni beradi (`third-party-auth-error`=iOS APNs, `invalid-argument`=buzuq token,
  va h.k.).
- Mobile'da: `FirebaseMessaging.onMessage` (foreground) va background handler'da
  **to'liq payload'ni log qiling** — banner bo'sh yoki kelmasa shu logdan bilinadi.

---

## 8. Tekshiruv checklist

**Registratsiya**
- [ ] Login'dan keyin `getToken()` → `POST /notifications/devices` (platform to'g'ri).
- [ ] `onTokenRefresh` → qayta register.
- [ ] Logout → `DELETE /notifications/devices` (+ `deleteToken()`).
- [ ] `GET /notifications/devices` — token ro'yxatda, `isActive:true`.

**Suppression (§6) tushunilgan**
- [ ] Chat ekranidan chiqqanda `leave:department`; background'da socket disconnect.
- [ ] Foreground'da FCM banner bostirilgan, lekin background/terminated'da EMAS.
- [ ] `notificationsEnabled` holati tekshirildi.

**Ko'rsatish**
- [ ] Background handler banner'ni `data.title/body` dan quradi (bo'sh banner yo'q).
- [ ] iOS badge `aps.badge` bilan avtomatik; Android `data.unreadCount` bilan qo'yildi.
- [ ] iOS: Firebase Console'da APNs `.p8` bor.
