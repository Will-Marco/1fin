# User'ni Departmentlarga Biriktirish

## Kerakli ID'lar

| ID | Endpoint | Path |
|----|----------|------|
| `userId` | `GET /users?search={name}` | `data[].id` |
| `membershipId` | `GET /users/{userId}` | `memberships[].id` |
| `companyId` | `GET /users/{userId}` | `memberships[].company.id` |
| `departmentIds` | `GET /companies/{companyId}/departments` | `[].globalDepartment.id` |

## Mavjud membership'ni yangilash

```http
PATCH /users/{userId}/memberships/{membershipId}
```

```json
{
  "allowedDepartmentIds": ["dept-id-1", "dept-id-2"],
  "rank": 1
}
```

## Yangi membership yaratish

```http
POST /users/{userId}/memberships
```

```json
{
  "companyId": "company-id",
  "allowedDepartmentIds": ["dept-id-1", "dept-id-2"],
  "rank": 1
}
```

> `rank` (1-3) faqat `CLIENT_EMPLOYEE` va `FIN_EMPLOYEE` uchun.
