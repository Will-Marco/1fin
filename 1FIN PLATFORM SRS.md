# 1FIN PLATFORM

## Software Requirements Specification (SRS)

**Version:** 2.0

**Status:** Authoritative (Updated SRS Supersedes MVP Implementation)

---

# 1. Introduction

## 1.1 Purpose

Ushbu hujjat 1Fin platformasining yangilangan biznes talablarini va backend arxitektura bilan moslashtirilgan texnik spetsifikatsiyasini belgilaydi.

Ushbu SRS:

- Yangilangan biznes talablarni to‘liq qamrab oladi
- Mavjud backendni refaktor qilish uchun asos bo‘ladi
- Role, Permission, Document lifecycle va Department access modelini formalizatsiya qiladi

---

# 2. System Overview

1Fin — bu 1Fin kompaniyasi uchun ishlab chiqilayotgan ichki va client kompaniyalar bilan ishlash platformasi bo‘lib, quyidagilarni ta’minlaydi:

- Department-based chat
- Hujjat almashinuvi
- Accept / Reject workflow
- Statistik monitoring
- Multi-company user membership
- Audit va Notification tizimi

Platform owner: **1Fin**

---

# 3. Actor & Role Model

## 3.1 System-Level Roles

| Role | Description |
| --- | --- |
| `1FIN_DIRECTOR` | SuperAdmin, full system control |
| `1FIN_ADMIN` | System manager |
| `1FIN_EMPLOYEE` | Operational employee |

---

## 3.2 Company-Level Roles

| Role | Description |
| --- | --- |
| `CLIENT_FOUNDER` | Investor, monitoring role |
| `CLIENT_DIRECTOR` | Company director |
| `CLIENT_EMPLOYEE` | Company employee |

---

# 4. Multi-Company Membership Model

Users can belong to **multiple companies**.

## 4.1 Data Model (Conceptual)

```
User
 └─ memberships[]
     ├─ companyId
     ├─ companyRole
     ├─ allowedDepartments[]
     └─ isActive
```

Constraints:

- No user is limited to a single company.
- Department access is defined at membership level.
- Departments are assigned during user-company binding (NOT user creation).

---

# 5. Rank System (⭐ Indicator)

Each user has:

```
rank: number
```

- Stored globally (user-level)
- Used for UI display
- Independent from role logic
- Purely representational (no permission impact)

---

# 6. Department Model

Departments are global entities.

Example:

- Bank Oplata
- Dogovor
- TTN
- HR
- Xatlar
- etc.

Company-level configuration:

```
CompanyDepartmentConfig
 ├─ companyId
 ├─ departmentId
 └─ isEnabled
```

User-level access:

```
membership.allowedDepartments[]
```

Access to department requires:

1. Department enabled for company
2. Department included in user membership

---

# 7. Chat System

All roles can chat.

Message types:

- TEXT
- IMAGE
- VIDEO
- AUDIO
- FILE
- DOCUMENT_FORWARD

Validation rules:

- Forward requires:
    - target department
    - document number
    - comment
- Audio/Text/Image/Video do NOT require metadata

Soft delete:

- Messages are soft-deleted
- Audit preserved

---

# 8. Document Lifecycle

## 8.1 Status Enum

```
PENDING
ACCEPTED
REJECTED
AUTO_EXPIRED
```

## 8.2 Rules

- When 1Fin sends document → status = PENDING
- CLIENT_DIRECTOR and CLIENT_EMPLOYEE can:
    - ACCEPT
    - REJECT
- CLIENT_FOUNDER cannot change status
- 10 days without action → AUTO_EXPIRED
- Daily reminder until resolved
- All status changes are logged

---

# 9. Bank Oplata Special Rule

- No Accept/Reject
- File exchange only
- Audit log recorded

---

# 10. Permission Matrix

## 10.1 System Roles

| Action | 1FIN_DIRECTOR | 1FIN_ADMIN | 1FIN_EMPLOYEE |
| --- | --- | --- | --- |
| Manage Companies | ✅ | ✅ | ❌ |
| Manage Users | ✅ | ✅ | ❌ |
| Manage Departments | ✅ | ✅ | ❌ |
| View Statistics | ✅ | ✅ | ❌ |
| Chat | ✅ | ✅ | ✅ |
| Accept/Reject | ✅ | ✅ | ✅ |

---

## 10.2 Client Roles

| Action | CLIENT_FOUNDER | CLIENT_DIRECTOR | CLIENT_EMPLOYEE |
| --- | --- | --- | --- |
| Manage Users | ❌ | ❌ | ❌ |
| View Statistics | ✅ | ✅ | ❌ |
| Chat | ✅ | ✅ | ✅ |
| Accept/Reject | ❌ | ✅ | ✅ |

---

# 11. Statistics

Visible to:

- 1FIN_DIRECTOR
- 1FIN_ADMIN
- CLIENT_FOUNDER
- CLIENT_DIRECTOR

Not visible to:

- 1FIN_EMPLOYEE
- CLIENT_EMPLOYEE

Manual statistics override automated calculations.

Time aggregation:

- Daily
- Weekly
- Monthly

---

# 12. Notifications

- All users have notifications enabled by default
- CLIENT_FOUNDER may disable only their own notifications
- Others cannot disable notifications
- Reminders sent daily for PENDING documents
- Status change triggers notification

---

# 13. Audit & Logging

Must log:

- Message delete
- Document status change
- Accept/Reject actor
- AUTO_EXPIRED trigger
- Forward actions

Audit data immutable.

---

# 14. Backend Architectural Mapping

## 14.1 Core Entities

- User
- Company
- UserCompanyMembership
- Department
- CompanyDepartmentConfig
- Message
- Document
- DocumentActionLog
- Notification
- ManualStatistic

---

## 14.2 Required Refactor Areas

### Prisma Schema Changes

- Introduce UserCompanyMembership
- Remove single-company constraint
- Add rank field to User
- Add Document entity (separate from File)
- Add AUTO_EXPIRED status
- Add allowedDepartments relation

---

### Permission Layer Redesign

Introduce:

- CompanyContextResolver
- MembershipResolver
- DepartmentAccessGuard
- DocumentPermissionGuard

---

### Cron Jobs

- Daily document reminder
- AUTO_EXPIRED trigger (10-day threshold)

---

# 15. Non-Functional Requirements

## Security

- JWT authentication
- Role + membership validation per request
- Department-level authorization
- Immutable audit logs

## Scalability

- Many-to-many user-company model
- Department-based isolation
- Event-driven document status updates

## Maintainability

- Separation of Message vs Document
- Clear enum-driven status machine
- Guard-based permission enforcement

---

# 16. Refactor Impact Summary

This SRS requires:

- Role model redesign
- Membership-based permission system
- Document state machine introduction
- Multi-company support enforcement
- Department-level access control
- Rank field addition

Production impact: None (no live production).

---

# STATUS

This SRS v2.0:

- Supersedes MVP logic where conflicts exist
- Is authoritative specification
- Must be used as backend refactor reference