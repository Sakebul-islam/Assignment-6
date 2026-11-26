# 🏠 RoomMate Hub: Housing & Roommate Platform API

> A RESTful API that helps students and young professionals find a **room and compatible roommates**, lets **property owners** list rooms with a fixed number of seats, approve tenants and collect payments online, and gives **admins** full control over listings, users and payments.

**Backend Project Assignment** · Project #6 (Housing & Roommate Platform) · Backend only
Node.js · TypeScript · Express · PostgreSQL · Prisma · Stripe · Redis

---

## 🔗 Links

| | |
|---|---|
| **API Docs (Postman)** | `<https://documenter.getpostman.com/view/xyz>` |
| **Demo Video** | `<https://drive.google.com/file/d/xyz/view>` |
| **Backend Repo** | `<https://github.com/your-username/roommate-hub-backend>` |

### Demo credentials (evaluation only)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@roommatehub.com` | `<demo-password>` |
| Owner | `owner@roommatehub.com` | `<demo-password>` |
| Tenant | `tenant@roommatehub.com` | `<demo-password>` |

> Dedicated demo accounts created by the seed script. They are not personal or production credentials.

### Build status

| Phase | Content | Endpoints | Status |
|---|---|:-:|:-:|
| **Phase 1: Assignment core** | Everything the assignment requires | 42 | ☐ |
| **Phase 2: Idea Hub features** | Roommate profiles, matching, viewings, tenant verification, rent tracking, utility bills, maintenance, rental documents, notifications, owner dashboard | 27 | ☐ |
| **Phase 3: Email extras** | Email verification, password reset, transactional emails, daily cleanup | 4 | ☐ |

> Tick each phase only after it passes all its checks (types, lint, build and the full API test suite). Remove rows of phases that were not built before submitting.

---

## 📌 Table of contents

1. [Problem and solution](#-problem-and-solution)
2. [Roles and permissions](#-roles-and-permissions)
3. [Features](#-features)
4. [Tech stack](#-tech-stack)
5. [Architecture](#-architecture)
6. [Database design](#-database-design)
7. [Workflows and business rules](#-workflows-and-business-rules)
8. [API reference](#-api-reference)
9. [Response format and errors](#-response-format-and-errors)
10. [Payment flow](#-payment-flow)
11. [Security and performance](#-security-and-performance)
12. [Testing](#-testing)
13. [Getting started](#-getting-started)
14. [Environment variables](#-environment-variables)
15. [Scripts](#-scripts)
16. [Project structure](#-project-structure)

---

## 🎯 Problem and solution

**Problem:** In cities like Dhaka, students and young professionals find rooms through Facebook groups and word of mouth. Listings are unverified, the same room is promised to two people, and money is paid in cash with no record.

**Solution:** RoomMate Hub gives owners a structured way to list **properties and rooms with a fixed number of seats**, which an admin verifies before they become public. Tenants search by location, rent and gender preference and **apply** for a seat. When an owner approves, the seat is **reserved for 48 hours inside a database transaction** and the price is locked. The tenant pays the **move-in amount (deposit + first month) through Stripe**; the signed Stripe webhook turns the application into a **tenancy**. Tenancies can be ended with notice, which frees the seat. Every critical action is in an **audit log**.

Phase 2 adds roommate profiles with a **compatibility score**, viewing requests, tenant identity verification, monthly rent invoices, **utility bill splitting**, maintenance requests, rental documents, notifications and an owner dashboard.

---

## 👥 Roles and permissions

| Role | Who | Description |
|---|---|---|
| **TENANT** | Students, professionals, roommates | Searches rooms, applies, pays, gives notice (Phase 2: roommate profile, viewings, verification, rent, bills, maintenance) |
| **OWNER** | Property owners or managers | Lists properties and rooms, approves applications, ends tenancies (Phase 2: viewings, invoices, bills, maintenance, dashboard) |
| **ADMIN** | Platform team | Verifies properties, manages users and roles, sees all payments, stats and audit logs |

Users choose **TENANT** or **OWNER** at registration. **ADMIN** accounts are created only by the seed script.

### Permission matrix

"own" = the user's own record; for owners, their own properties and everything in them.

| Action | TENANT | OWNER | ADMIN | Phase |
|---|:-:|:-:|:-:|:-:|
| Register, log in, Google login, refresh, logout, change password | ✅ | ✅ | ✅ | 1 |
| View and update own profile, avatar | ✅ | ✅ | ✅ | 1 |
| Browse approved properties and rooms | public | public | public | 1 |
| Create / update property and rooms | ❌ | own | ❌ | 1 |
| Soft-delete property or room | ❌ | own | ✅ | 1 |
| Apply for a seat / withdraw | ✅ | ❌ | ❌ | 1 |
| See applications | own | own rooms | all | 1 |
| Approve / reject an application | ❌ | own rooms | ❌ | 1 |
| Pay (checkout) | ✅ | ❌ | ❌ | 1 |
| See payments and tenancies | own | own rooms | all | 1 |
| Give notice | ✅ | ❌ | ❌ | 1 |
| End a tenancy | ❌ | own rooms | ✅ | 1 |
| Manage users, verify properties, stats, audit logs | ❌ | ❌ | ✅ | 1 |
| Roommate profile, match score, recommendations | ✅ | ❌ | ❌ | 2 |
| Request / cancel viewing | ✅ | ❌ | ❌ | 2 |
| Accept / reject / complete viewing | ❌ | own rooms | ❌ | 2 |
| Submit identity verification / review it | ✅ / ❌ | ❌ | ❌ / ✅ | 2 |
| Issue rent invoice | ❌ | own rooms | ✅ | 2 |
| Create and split a utility bill | ❌ | own rooms | ❌ | 2 |
| Report maintenance / update it | ✅ / reopen | ❌ / own | ❌ / ✅ | 2 |
| Rental agreement and documents | own tenancy | own rooms | view | 2 |
| Notifications | own | own | own | 2 |
| Owner dashboard | ❌ | ✅ | ❌ | 2 |

> Wrong role → **403 Forbidden**. Another user's record → **404 Not Found** (the API does not reveal that it exists).

---

## ✨ Features

### Phase 1: Assignment core
- **Authentication:** email/password registration and login, **Google (GCP) login**, JWT access tokens sent as `Authorization: Bearer`, rotating refresh tokens with reuse detection, logout, change password.
- **Role-based access control** for TENANT, OWNER and ADMIN, plus ownership checks on every record.
- **Property listings** (buildings and flats) with images, amenities and house rules; **admin verification** before they become public.
- **Rooms with seats:** `capacity`, `occupiedSeats`, `reservedSeats`, `availableSeats`; availability date; gender preference.
- **Search, filter, sort, paginate** properties and rooms; results **cached in Redis**.
- **Applications with seat reservation:** approval reserves a seat for **48 hours** and locks the price, in one transaction; expired reservations are released automatically.
- **Stripe payments:** move-in amount (deposit + first month), **signed webhook**, idempotent, automatic refund when a paid seat can no longer be given, full payment history.
- **Tenancies:** created only by a paid application; notice and end (frees the seat).
- **Admin:** user search, block/unblock, role change, property review queue, dashboard statistics, **audit logs**.
- **Soft delete** for properties, rooms and removed images (nothing is hard deleted); **audit log** for every critical action.
- **Uploads** with Multer + Cloudinary (size and type limits).
- **Security:** helmet, CORS allow-list, Redis-backed rate limiting, body size limits, validated environment.

### Phase 2: Idea Hub features for project #6
- **Roommate profiles** (budget, smoking, pets, sleep schedule, cleanliness, preferred areas).
- **Preference matching:** a 0–100 compatibility score against a room's current occupants, plus ranked recommendations.
- **Viewing requests** with 30-minute slot protection.
- **Tenant verification:** NID, student ID or passport reviewed by an admin through a private, short-lived link; owners can require verified tenants per property.
- **Rent tracking:** monthly invoices with due dates, overdue status and online payment.
- **Utility bill splitting:** a room's bill split equally among its tenants (exact to the poisha); each share paid through Stripe.
- **Maintenance requests** with priority, photos and a status workflow.
- **Rental documents:** an automatically generated agreement PDF and uploaded documents, stored privately.
- **Notifications** for every important event.
- **Owner dashboard:** occupancy, rent collected, overdue amounts, pending applications, open maintenance.

### Phase 3: Email extras
- Email verification badge, password reset by email, transactional emails (approval, receipt, verification result), daily cleanup job.

---

## 🛠️ Tech stack

| Category | Technology |
|---|---|
| Runtime & framework | Node.js, TypeScript, Express.js 5 |
| Database & ORM | PostgreSQL, Prisma 7 with `@prisma/adapter-pg` |
| Validation | Zod |
| Authentication | JWT (Bearer), bcrypt, Google OAuth (`google-auth-library`) |
| Payments | Stripe Checkout + webhooks (test mode) |
| Caching & rate-limit store | Redis |
| File storage | Multer (memory) + Cloudinary |
| Security | helmet, express-rate-limit, cors |
| PDF (Phase 2) | pdfkit |
| Email (Phase 3) | Nodemailer + EJS templates |
| Linting & formatting | Biome |
| Build | tsup |
| Package manager | Bun |
| Testing | Postman + newman |

---

## 🏗️ Architecture

```
Request
  │
  ▼
helmet → cors → rate limit (Redis) → router /api/v1/...
  │
  ▼
auth(...roles) → validateRequest({ body, query, params })
  │
  ▼
Controller   catchAsync, reads validated input + req.user, answers with sendResponse
  │
  ▼
Service      business rules, ownership checks, guarded updates in transactions,
             Redis cache, Stripe, Cloudinary, audit log
  │
  ▼
Prisma ORM → PostgreSQL (CHECK constraints + partial unique indexes as a safety net)
  │
  ▼
notFound → globalErrorHandler → { success: false, message, errors: [] }
```

The code follows the **PH Healthcare Backend** structure: each feature is a module in `src/app/module/<feature>/` with `<feature>.route.ts`, `.controller.ts`, `.service.ts`, `.validation.ts` and `.interface.ts`.

---

## 🗄️ Database design

### ERD

```mermaid
erDiagram
    User ||--o{ RefreshToken : has
    User ||--o{ Property : owns
    Property ||--o{ PropertyImage : has
    Property ||--o{ Room : contains
    Room ||--o{ RoomImage : has
    Room ||--o{ Application : receives
    User ||--o{ Application : submits
    Application ||--o| Tenancy : becomes
    Room ||--o{ Tenancy : hosts
    User ||--o{ Tenancy : rents
    User ||--o{ Payment : pays
    Application ||--o{ Payment : "move-in"
    User ||--o{ AuditLog : performs
    User ||--o| RoommateProfile : "has (P2)"
    Room ||--o{ ViewingRequest : "receives (P2)"
    User ||--o{ VerificationRequest : "submits (P2)"
    Tenancy ||--o{ RentInvoice : "billed (P2)"
    RentInvoice ||--o{ Payment : "rent (P2)"
    Room ||--o{ UtilityBill : "billed (P2)"
    UtilityBill ||--o{ BillShare : "split into (P2)"
    BillShare ||--o{ Payment : "bill share (P2)"
    Tenancy ||--o{ MaintenanceRequest : "reports (P2)"
    Tenancy ||--o{ TenancyDocument : "has (P2)"
    User ||--o{ Notification : "receives (P2)"
```

### Models

| Model | Phase | Purpose | Key fields |
|---|:-:|---|---|
| `User` | 1 | Account | `email` (unique), `password?` (null for Google-only), `googleId?`, `authProvider`, `phone`, `gender`, `role`, `status`, `tokenVersion` |
| `RefreshToken` | 1 | Rotating refresh tokens | `tokenHash` (unique), `expiresAt`, `revokedAt`, `replacedBy` |
| `Property` | 1 | Building or flat | `ownerId`, `title`, `city`, `area`, `address`, `amenities[]`, `status` (PENDING / APPROVED / REJECTED), `rejectionReason`, `reviewedById`, `deletedAt` |
| `PropertyImage` / `RoomImage` | 1 | Photos | `url`, `publicId`, `deletedAt` |
| `Room` | 1 | Room with seats | `roomType`, `monthlyRent`, `deposit`, `capacity`, `occupiedSeats`, `reservedSeats`, `availableSeats`, `genderPreference`, `availableFrom`, `deletedAt` |
| `Application` | 1 | Request for a seat | `moveInDate`, `status` (PENDING / APPROVED / REJECTED / WITHDRAWN / EXPIRED / CONVERTED), `quotedRent`, `quotedDeposit`, `reservedUntil` |
| `Tenancy` | 1 | A stay | `applicationId` (unique), `startDate`, `endDate`, `monthlyRent`, `deposit`, `status` (ACTIVE / NOTICE_GIVEN / ENDED) |
| `Payment` | 1 | Stripe payment | `purpose` (MOVE_IN; + RENT, BILL_SHARE in P2), `amount`, `currency`, `status` (PENDING / PAID / FAILED / CANCELLED / REFUNDED), `stripeSessionId`, `stripePaymentIntentId` |
| `AuditLog` | 1 | Who did what | `actorId?`, `action`, `entity`, `entityId`, `before`, `after` |
| `RoommateProfile` | 2 | Lifestyle and budget | `occupation`, `budgetMin`, `budgetMax`, `smoking`, `pets`, `sleepSchedule`, `cleanliness`, `preferredAreas[]` |
| `ViewingRequest` | 2 | Room visit | `scheduledAt`, `slotStart`, `status` |
| `VerificationRequest` | 2 | Identity check | `documentType`, `documentNumber` (masked), private document, `status` |
| `RentInvoice` | 2 | Monthly rent | `month`, `amount`, `dueDate`, `status`; unique `[tenancyId, month]` |
| `UtilityBill` / `BillShare` | 2 | Split bills | `type`, `month`, `totalAmount`; one share per tenancy |
| `MaintenanceRequest` | 2 | Repair issue | `priority`, `status`, `images`, `deletedAt` |
| `TenancyDocument` | 2 | Rental documents | `type`, `name`, private file |
| `Notification` | 2 | In-app message | `type`, `title`, `message`, `isRead` |

### Constraints and indexes

- **CHECK constraints:** seats never negative and `occupiedSeats + reservedSeats + availableSeats = capacity`; capacity 1–10; rent > 0; payment amount > 0; every payment points to the right target.
- **Partial unique indexes:** one open application per tenant per room; one live tenancy per tenant; at most one pending and one paid payment per application (and per invoice / bill share in Phase 2); one accepted viewing per room per 30-minute slot (Phase 2).
- **Unique:** `User.email`, `User.googleId`, `Payment.stripeSessionId`, `Payment.stripePaymentIntentId`, `Tenancy.applicationId`.
- **Indexes:** every foreign key; `Property [status, city, area]`; `Room [monthlyRent]`, `[availableFrom]`, `[availableSeats]`; `Application [roomId, status]`, `[tenantId, status]`, `[status, reservedUntil]`; `AuditLog [entity, entityId]`, `[createdAt]`.
- **Soft delete:** `Property`, `Room`, `PropertyImage` and `RoomImage` (and `MaintenanceRequest` in Phase 2) use `deletedAt`; deleted records return 404 or are hidden from responses. Images removed with `removeImageIds` keep their row and Cloudinary file.
- **Money:** `Decimal(10, 2)` in BDT. Calendar dates are stored as dates; timestamps in UTC.

---

## 🔄 Workflows and business rules

### Property verification (Phase 1)

```
PENDING ──(admin approves)──► APPROVED ──(owner edits title/address/city/area)──► PENDING
   └──(admin rejects + reason)──► REJECTED ──(owner edits = resubmits)──► PENDING
```

- Only APPROVED, non-deleted properties and their rooms are public.
- A property or room can be deleted only when it has no occupied or reserved seats; its pending applications are rejected with "Listing Removed".

### Application, seat reservation and move-in (Phase 1)

```
PENDING ──(owner approves: seat reserved 48h, price locked)──► APPROVED ──(Stripe paid)──► CONVERTED → Tenancy ACTIVE
   ├──(owner rejects)──► REJECTED                                  ├──(tenant withdraws)──► WITHDRAWN (seat released)
   └──(tenant withdraws)──► WITHDRAWN                              └──(48h pass)──► EXPIRED (seat released)
```

| Rule | Detail |
|---|---|
| Who can apply | A TENANT without a live tenancy, with at most 3 PENDING applications, one open application per room |
| Room checks | Room and property not deleted, property APPROVED, `availableSeats > 0`, gender preference respected, move-in date within 60 days and after `availableFrom` |
| Approve | One transaction: guarded seat reservation (`availableSeats > 0`) → guarded status update (`status = PENDING`) → price locked → `reservedUntil = now + 48h` → audit log |
| Expiry | Expired reservations are released whenever the room or application is read (and by the daily cron in Phase 3) |
| Payment | Amount = locked deposit + locked rent, calculated on the server |
| Conversion | Signed webhook, one transaction: application CONVERTED → payment PAID → seat reserved → occupied → tenancy created → the tenant's other open applications withdrawn → audit log |
| Late payment | If the reservation expired but a seat is still free, it is re-reserved and converted; if not, the payment is refunded automatically |

### Tenancy (Phase 1)

```
ACTIVE ──(tenant gives notice, end ≥ 30 days ahead)──► NOTICE_GIVEN ──(owner/admin ends)──► ENDED
   └───────────────────────(owner/admin ends)────────────────────────────────────────────► ENDED
```

- Ending a tenancy frees the seat. Before the start date only an admin can end it, and the move-in payment is refunded.

### Phase 2 workflows

| Feature | Flow | Key rules |
|---|---|---|
| Viewings | REQUESTED → ACCEPTED → COMPLETED; or REJECTED / CANCELLED | 2 hours to 30 days ahead, 08:00–21:00; one open viewing per tenant per room; one accepted viewing per room per 30-minute slot |
| Tenant verification | PENDING → APPROVED (`isVerified = true`) or REJECTED | One pending request; document visible to admins only through a 10-minute link; number masked |
| Rent invoices | UNPAID → PAID; UNPAID → OVERDUE → PAID; CANCELLED when the tenancy ends | One per tenancy per month, for months after the start month; due on the 10th |
| Utility bills | Bill → equal shares; each share UNPAID → PAID / OVERDUE / CANCELLED | One bill per room, type and month; shares add up exactly to the total |
| Maintenance | OPEN → IN_PROGRESS → RESOLVED → CLOSED | Live tenancies only; URGENT first; tenant can reopen within 7 days |
| Rental documents | Agreement PDF generated on first request | Private files, 10-minute signed links, tenant/owner/admin only |

### Roommate matching (Phase 2)

| Factor | Weight | Scoring |
|---|:-:|---|
| Budget fits rent | 25 | Full inside the budget, 12 within 15 % of it |
| Gender preference | 20 | Must fit, otherwise the room is excluded |
| Smoking | 15 | Same answer |
| Sleep schedule | 15 | Same = 15, one FLEXIBLE = 8 |
| Cleanliness | 15 | `15 − 5 × difference` |
| Occupation | 5 | Same |
| Pets | 5 | Same |

The last five factors are averaged over the room's current occupants. An empty room scores on budget, gender and preferred area.

---

## 📚 API reference

**Base URL:** `http://localhost:5000/api/v1`
**Auth header:** `Authorization: Bearer <accessToken>`
Full request and response examples are in the [Postman documentation](<postman-link>).

The API is built in three phases. **Phase 1 is everything the assignment requires** and is complete on its own. Phase 2 adds the features the Idea Hub lists for project #6, and Phase 3 adds optional email features. Each phase only adds endpoints; nothing in an earlier phase changes.

### Phase 1: Assignment core (42 endpoints)

**Auth**

| # | Method | Endpoint | Access | Description |
|:-:|---|---|---|---|
| E01 | POST | `/auth/register` | Public | Register as TENANT or OWNER; returns tokens |
| E02 | POST | `/auth/login` | Public | Log in; returns access and refresh tokens |
| E03 | POST | `/auth/google` | Public | Log in or sign up with a Google ID token |
| E04 | POST | `/auth/refresh-token` | Public | Rotate the refresh token, get a new access token |
| E05 | POST | `/auth/logout` | Public (refresh token) | Revoke the refresh token |
| E06 | PATCH | `/auth/change-password` | Logged in | Change password; signs out other sessions |

**Users**

| # | Method | Endpoint | Access | Description |
|:-:|---|---|---|---|
| E07 | GET | `/users/me` | Logged in | Own profile |
| E08 | PATCH | `/users/me` | Logged in | Update name, phone, gender |
| E09 | PATCH | `/users/me/avatar` | Logged in | Upload profile photo (Cloudinary); multipart with only the `avatar` file field |

**Properties**

| # | Method | Endpoint | Access | Description |
|:-:|---|---|---|---|
| E10 | POST | `/properties` | OWNER | Create a property (PENDING) with images |
| E11 | GET | `/properties` | Public | Approved properties: `?searchTerm&city&area&amenities&page&limit&sortBy&sortOrder` |
| E12 | GET | `/properties/mine` | OWNER | Own properties in every status, with seat totals |
| E13 | GET | `/properties/:propertyId` | Public | Property with its rooms |
| E14 | PATCH | `/properties/:propertyId` | OWNER (own) | Update; title/address changes go back to admin review |
| E15 | DELETE | `/properties/:propertyId` | OWNER (own), ADMIN | Soft delete (blocked if it has tenants or reserved seats) |

**Rooms and availability**

| # | Method | Endpoint | Access | Description |
|:-:|---|---|---|---|
| E16 | POST | `/properties/:propertyId/rooms` | OWNER (own) | Add a room with seats and images |
| E17 | GET | `/rooms` | Public | Search: `?searchTerm&city&area&minRent&maxRent&roomType&genderPreference&availableBy&onlyAvailable&page&limit&sortBy&sortOrder` (Redis cached) |
| E18 | GET | `/rooms/:roomId` | Public | Room details with free, reserved and occupied seats |
| E19 | PATCH | `/rooms/:roomId` | OWNER (own) | Update rent, capacity (never below occupied + reserved), dates, images |
| E20 | DELETE | `/rooms/:roomId` | OWNER (own), ADMIN | Soft delete (blocked if occupied or reserved) |

**Applications**

| # | Method | Endpoint | Access | Description |
|:-:|---|---|---|---|
| E21 | POST | `/rooms/:roomId/applications` | TENANT | Apply for a seat |
| E22 | GET | `/applications` | TENANT, OWNER, ADMIN | Own applications / applications to own rooms / all |
| E23 | GET | `/applications/:applicationId` | Applicant, room owner, ADMIN | Application details |
| E24 | PATCH | `/applications/:applicationId/decision` | OWNER (own room) | Approve (reserves a seat for 48 h, locks the price) or reject with a reason |
| E25 | PATCH | `/applications/:applicationId/withdraw` | TENANT (own) | Withdraw (releases a reserved seat) |

**Payments**

| # | Method | Endpoint | Access | Description |
|:-:|---|---|---|---|
| E26 | POST | `/payments/checkout` | TENANT | Stripe Checkout for the move-in amount of an approved application; returns `checkoutUrl` |
| E27 | POST | `/payments/webhook` | Stripe | Signed webhook: records the payment and creates the tenancy |
| E28 | GET | `/payments/success` | Stripe redirect | Shows the payment status |
| E29 | GET | `/payments/cancel` | Stripe redirect | Cancels the open checkout |
| E30 | GET | `/payments` | TENANT, OWNER, ADMIN | Payment history with filters |
| E31 | GET | `/payments/:paymentId` | Payer, room owner, ADMIN | Payment details |

**Tenancies**

| # | Method | Endpoint | Access | Description |
|:-:|---|---|---|---|
| E32 | GET | `/tenancies` | TENANT, OWNER, ADMIN | Tenancies with filters |
| E33 | GET | `/tenancies/:tenancyId` | Tenant, room owner, ADMIN | Tenancy details |
| E34 | PATCH | `/tenancies/:tenancyId/notice` | TENANT (own) | Give notice (end date at least 30 days ahead) |
| E35 | PATCH | `/tenancies/:tenancyId/end` | OWNER (own room), ADMIN | End the tenancy and free the seat |

**Admin**

| # | Method | Endpoint | Access | Description |
|:-:|---|---|---|---|
| E36 | GET | `/admin/users` | ADMIN | Users: `?searchTerm&role&status&page&limit&sortBy&sortOrder` |
| E37 | PATCH | `/admin/users/:userId/status` | ADMIN | Block or unblock (signs the user out everywhere) |
| E38 | PATCH | `/admin/users/:userId/role` | ADMIN | Change role between TENANT and OWNER |
| E39 | GET | `/admin/properties` | ADMIN | Review queue (`?status=PENDING`) |
| E40 | PATCH | `/admin/properties/:propertyId/verify` | ADMIN | Approve or reject a property |
| E41 | GET | `/admin/dashboard-stats` | ADMIN | Users, listings, occupancy, revenue, application funnel |
| E42 | GET | `/admin/audit-logs` | ADMIN | Audit trail: `?entity&action&actorId&from&to&page&limit` |

### Phase 2: Idea Hub features for project #6 (27 endpoints)

| # | Method | Endpoint | Access | Feature |
|:-:|---|---|---|---|
| E43 | PUT | `/users/me/roommate-profile` | TENANT | Roommate profiles |
| E44 | GET | `/users/me/roommate-profile` | TENANT | Roommate profiles |
| E45 | GET | `/rooms/:roomId/match` | TENANT | Preference matching (0–100 score) |
| E46 | GET | `/rooms/recommended` | TENANT | Preference matching (ranked rooms) |
| E47 | POST | `/rooms/:roomId/viewings` | TENANT | Viewing requests |
| E48 | GET | `/viewings` | TENANT, OWNER | Viewing requests |
| E49 | PATCH | `/viewings/:viewingId/status` | OWNER (own room) | Viewing requests (accept, reject, complete) |
| E50 | PATCH | `/viewings/:viewingId/cancel` | TENANT (own) | Viewing requests |
| E51 | POST | `/users/me/verification` | TENANT | Tenant verification (NID / student ID / passport) |
| E52 | GET | `/admin/verifications` | ADMIN | Tenant verification review queue |
| E53 | PATCH | `/admin/verifications/:requestId` | ADMIN | Tenant verification decision |
| E54 | POST | `/tenancies/:tenancyId/invoices` | OWNER (own room), ADMIN | Rent tracking (issue invoice) |
| E55 | GET | `/invoices` | TENANT, OWNER, ADMIN | Rent tracking |
| E56 | GET | `/invoices/:invoiceId` | Tenant, room owner, ADMIN | Rent tracking |
| E57 | POST | `/rooms/:roomId/utility-bills` | OWNER (own room) | Utility bill splitting |
| E58 | GET | `/utility-bills` | TENANT, OWNER, ADMIN | Utility bill splitting |
| E59 | GET | `/utility-bills/:billId` | Room owner, sharing tenants, ADMIN | Utility bill splitting |
| E60 | POST | `/tenancies/:tenancyId/maintenance` | TENANT (own) | Maintenance requests |
| E61 | GET | `/maintenance` | TENANT, OWNER, ADMIN | Maintenance requests |
| E62 | PATCH | `/maintenance/:requestId/status` | OWNER (own property), ADMIN | Maintenance requests |
| E63 | GET | `/tenancies/:tenancyId/agreement` | Tenant, room owner, ADMIN | Rental documents (agreement PDF) |
| E64 | POST | `/tenancies/:tenancyId/documents` | Tenant, room owner | Rental documents |
| E65 | GET | `/tenancies/:tenancyId/documents` | Tenant, room owner, ADMIN | Rental documents |
| E66 | GET | `/notifications` | Logged in | Notifications |
| E67 | PATCH | `/notifications/:notificationId/read` | Logged in (own) | Notifications |
| E68 | PATCH | `/notifications/read-all` | Logged in | Notifications |
| E69 | GET | `/owners/me/dashboard-stats` | OWNER | Owner/manager dashboard |

Phase 2 also lets `POST /payments/checkout` (E26) accept `{ invoiceId }` for rent and `{ billShareId }` for a utility bill share.

### Phase 3: Optional email features (4 endpoints)

| # | Method | Endpoint | Access | Description |
|:-:|---|---|---|---|
| E70 | POST | `/auth/email-verification` | Logged in | Send an email verification code |
| E71 | POST | `/auth/email-verification/confirm` | Logged in | Confirm the code (`emailVerified: true`) |
| E72 | POST | `/auth/password-reset` | Public | Send a password reset code |
| E73 | POST | `/auth/password-reset/confirm` | Public | Reset the password with the code |

**Total: 73 endpoints** (42 + 27 + 4). The assignment minimum is 20. A protected internal route `GET /api/v1/internal/cron/daily` (daily cleanup job) is not counted.

### Common query parameters

| Param | Example | Description |
|---|---|---|
| `page` | `1` | Page number (default 1) |
| `limit` | `10` | Items per page (default 10, max 50) |
| `sortBy` | `monthlyRent` | Allowed fields per endpoint (any other value → 400) |
| `sortOrder` | `asc` | `asc` or `desc` |
| `searchTerm` | `dhanmondi` | Case-insensitive text search |

---

## 📦 Response format and errors

**Success**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Application Approved. Seat Reserved Until 2026-11-27T10:00:00.000Z",
  "data": { "id": "0193…", "status": "APPROVED", "quotedRent": "5500.00", "reservedUntil": "2026-11-27T10:00:00.000Z" }
}
```

**Success with pagination**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Rooms Retrieved Successfully",
  "meta": { "page": 1, "limit": 10, "total": 37, "totalPages": 4 },
  "data": []
}
```

**Error**

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation Failed",
  "errors": [{ "path": "body.monthlyRent", "message": "Number must be greater than or equal to 500" }]
}
```

| Status | Example in this project |
|:-:|---|
| 200 / 201 | Room updated / application created |
| 400 | Invalid email, move-in date out of range, malformed JSON, unknown field |
| 401 | Missing token, expired token, session ended by a password change |
| 403 | Wrong role; blocked account; owner editing another owner's property |
| 404 | Unknown route; deleted room; another user's application |
| 409 | Room full; duplicate application; invalid status change; capacity below occupied seats |
| 410 | Seat reservation expired before payment |
| 413 | JSON body over 1 MB |
| 429 | Too many requests |
| 502 | Stripe or Cloudinary error |

Every response, including 404 and validation errors, uses this envelope.

---

## 💳 Payment flow

Gateway: **Stripe Checkout** (test mode). Currency: BDT (`STRIPE_CURRENCY`).

```
1. Owner   PATCH /applications/:id/decision { "decision": "APPROVE" }
           → seat reserved, price locked, reservedUntil = now + 48h

2. Tenant  POST /payments/checkout { "applicationId": "…" }
           → application must be the tenant's own, APPROVED, not expired
           → amount = locked deposit + locked rent (server-side)
           → Payment row (PENDING) first, then the Stripe session (metadata: paymentId)
           → returns { paymentId, amount, checkoutUrl, expiresAt }
           → calling again within 25 minutes returns the same checkoutUrl

3. Tenant  opens checkoutUrl and pays with a test card

4. Stripe  POST /payments/webhook  (checkout.session.completed)
           → signature verified (400 if invalid)
           → already processed? → 200, nothing changes
           → one transaction: application CONVERTED, payment PAID, seat reserved → occupied,
             tenancy created, other open applications withdrawn, audit log

5. Stripe  redirects to /payments/success?session_id=…  (or /payments/cancel, which closes the session)

6. Tenant  GET /payments/:id → { "status": "PAID" }    GET /tenancies → ACTIVE
```

| Case | Behaviour |
|---|---|
| Same webhook delivered twice (or at the same time) | Guarded updates: converted once, the second delivery changes nothing |
| Tenant cancels on Stripe | Payment CANCELLED; the reservation stays; a new checkout works |
| Card declined | Payment stays PENDING with the reason; the tenant can try again on the same page |
| Reservation expired before paying, seat still free | Seat re-reserved, converted normally |
| Reservation expired and seat taken, or tenant paid twice | Refunded automatically; payment REFUNDED |
| Client sends an amount | Rejected (400); amounts are always calculated on the server |

**Test cards:** `4242 4242 4242 4242` (success), `4000 0000 0000 9995` (declined); any future date, any CVC.
Phase 2 adds `{ "invoiceId": "…" }` (rent) and `{ "billShareId": "…" }` (utility share) to the same checkout endpoint.

---

## 🔐 Security and performance

**Security** (checked against the OWASP API Security Top 10)
- Passwords hashed with bcrypt (cost 12); never returned or logged.
- 1-day access tokens; 7-day refresh tokens that are random, stored only as hashes, rotated on every use; reuse of an old one signs the user out everywhere.
- Password change, blocking and role changes end all sessions immediately (`tokenVersion`).
- Role middleware plus ownership checks in every service; another user's record returns 404.
- Zod validation on body, query and params; unknown fields are rejected, so clients cannot set `status`, seats, `ownerId` or amounts.
- `helmet`, CORS allow-list, 1 MB JSON limit, upload type/size/count limits.
- Rate limits with a Redis store: 300 / 15 min per IP; 10 / 15 min on auth routes; 10 checkouts / 15 min per user.
- Stripe webhooks verified by signature on the raw body; payments become PAID only through a verified event.
- No secrets in the repository (`.env` is git-ignored); environment validated at startup.
- Phase 2: identity and rental documents are private Cloudinary files, opened only through 10-minute signed links.

**Performance**
- Indexes on all foreign keys and filter/sort fields; `select` returns only needed fields; `findMany` and `count` run in parallel.
- Redis cache: property and room search (60 s, version-key invalidation), property and room details (5 min), admin stats (2 min).
- Seat changes are single guarded SQL updates, so no locks are held across requests.

---

## 🧪 Testing

| Test | Command | What it proves |
|---|---|---|
| Type check | `bun run typecheck` | 0 TypeScript errors |
| Lint and format | `bun run check` | 0 Biome errors |
| API suite | `bun run test:api` | Every endpoint, every role, validation and error cases; every response uses the envelope; no 5xx |
| Concurrency | `bun run test:race` | Two approvals for the last seat → one 200, one 409; duplicate applications → one 201, one 409 |
| Webhook | `bun run test:webhook <paymentId>` or `bun run test:webhook --prepare <applicationId>` | A signed Stripe event converts the application once; repeating it changes nothing (`--prepare` creates the pending payment in the database, so no Stripe account is needed) |
| Data consistency | `bun run test:consistency` | Seat counts always equal live tenancies and approved applications (`--force-violation` also proves the database CHECK constraint) |

The Postman collection and environments are in [`postman/`](postman). `bun run test:api` runs the collection with newman and passes the demo passwords from `.env` in memory, so no password is stored in the collection or environment files. The folder **"07 Stripe checkout and tenancy"** runs automatically once real Stripe test keys are in `.env`; until then it is skipped. To use the collection in the Postman app, import both files and fill `adminPassword` and `demoPassword` as *current values* in the environment.

---

## 🚀 Getting started

### Prerequisites

- Node.js 20+ and Bun
- PostgreSQL 15+ (local or hosted)
- Redis (optional; local or hosted)
- Stripe account in test mode and the Stripe CLI
- Google Cloud OAuth client ID
- Cloudinary account

### Installation

```bash
git clone <https://github.com/your-username/roommate-hub-backend.git>
cd roommate-hub-backend
bun install
cp .env.example .env            # fill in your own values
bunx prisma migrate dev
bun run seed                    # demo admin, owner, tenant, properties and rooms
bun run dev
```

The API runs at `http://localhost:5000/api/v1`. Root check: `GET /`.

### Stripe webhooks on your computer

Stripe cannot call `localhost`, so the Stripe CLI forwards events:

```bash
winget install Stripe.StripeCli     # once (open a new terminal afterwards)
bun run stripe:listen               # keep it running next to `bun run dev`
```

The first time, get the signing secret with `stripe listen --print-secret` (with `STRIPE_API_KEY` set to your test key) and put it in `STRIPE_WEBHOOK_SECRET`.

### Adding or updating packages

Packages are always installed from the terminal, never typed into `package.json`:

```bash
bun add <package>               # runtime dependency
bun add -d <package>            # development dependency
bun update <package>            # update
bun remove <package>            # remove
bun audit                       # known vulnerabilities
```

---

## ⚙️ Environment variables

| Variable | Phase | Description | Example |
|---|:-:|---|---|
| `NODE_ENV` | 1 | `development` or `production` | `development` |
| `PORT` | 1 | Server port | `5000` |
| `BACKEND_URL` | 1 | Public API URL (Stripe redirects) | `http://localhost:5000` |
| `CORS_ORIGINS` | 1 | Allowed origins, comma-separated | `http://localhost:3000` |
| `DATABASE_URL` | 1 | PostgreSQL connection string | `postgresql://user:password@localhost:5432/roommate_hub?schema=public` |
| `REDIS_URL` | 1 | Redis connection string | `redis://default:password@localhost:6379` |
| `BCRYPT_SALT_ROUNDS` | 1 | bcrypt cost | `12` |
| `JWT_ACCESS_SECRET` | 1 | Access token secret (64 hex characters) | `change-me` |
| `JWT_ACCESS_EXPIRES_IN` | 1 | Access token lifetime | `1d` |
| `REFRESH_TOKEN_EXPIRES_DAYS` | 1 | Refresh token lifetime | `7` |
| `GOOGLE_CLIENT_ID` | 1 | GCP OAuth client ID | `xxxx.apps.googleusercontent.com` |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | 1 | File storage | `demo` / `123` / `change-me` |
| `STRIPE_SECRET_KEY` | 1 | Stripe secret key (test) | `sk_test_…` |
| `STRIPE_WEBHOOK_SECRET` | 1 | Webhook signing secret | `whsec_…` |
| `STRIPE_CURRENCY` | 1 | Payment currency | `bdt` |
| `RESERVATION_HOURS` | 1 | Seat hold after approval | `48` |
| `RATE_LIMIT_API_MAX` / `RATE_LIMIT_AUTH_MAX` | 1 | Requests per 15 minutes per IP (keep the defaults; raise only for long local test runs) | `300` / `10` |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` / `SEED_DEMO_PASSWORD` | 1 | Demo accounts for the seed | `admin@roommatehub.com` / `change-me` / `change-me` |
| `SMTP_USER` / `GOOGLE_APP_PASSWORD` / `EMAIL_FROM` | 3 | Gmail sender | `noreply@example.com` / `…` / `RoomMate Hub <noreply@example.com>` |
| `CRON_SECRET` | 3 | Protects the daily cleanup route | `change-me` |

All keys are listed in [`.env.example`](.env.example) with placeholder values. The app validates them with Zod at startup and stops if one is missing.

---

## 📜 Scripts

| Script | Description |
|---|---|
| `bun run dev` | Start in watch mode (`tsx watch src/server.ts`) |
| `bun run build` | Build with tsup into `dist/` |
| `bun run start` | Run the build (`node dist/server.js`) |
| `bun run seed` | Seed demo users and data (safe to run again) |
| `bun run typecheck` | TypeScript check |
| `bun run check` / `bun run check:fix` | Biome lint and format (tabs, double quotes) |
| `bun run gate` | Typecheck + Biome + build in one step |
| `bun run test:api` | newman API suite |
| `bun run test:race` | Concurrency tests |
| `bun run test:webhook <paymentId>` | Signed Stripe webhook test |
| `bun run test:consistency` | Seat and payment consistency check |
| `bun run stripe:listen` | Forward real Stripe test events to the local webhook (uses `STRIPE_SECRET_KEY` from `.env`, no `stripe login` needed) |
| `bunx prisma studio` | Database GUI |

---

## 📁 Project structure

Same structure as the **PH Healthcare Backend**:

```
.
├── prisma/
│   ├── schema/                    # schema.prisma, enums.prisma, one file per model group
│   └── migrations/                # includes the db_rules SQL migration
├── postman/                       # collection + environment (no secrets)
├── src/
│   ├── app.ts                     # Express app, middleware, routes
│   ├── server.ts                  # starts the server (app.listen)
│   ├── generated/prisma/          # generated Prisma client (gitignored)
│   └── app/
│       ├── config/index.ts        # zod-validated config object
│       ├── interfaces/index.ts    # IQuery and shared types
│       ├── lib/                   # prisma, redis, stripe, cloudinary, multer, googleAuth, rateLimiter
│       ├── middleware/            # checkAuth (auth, optionalAuth), validateRequest, globalErrorHandler, notFound
│       ├── utils/                 # AppError, catchAsync, sendResponse, jwt, tokens, queryBuilder,
│       │                          # seats, expiry, transitions, audit, cache, upload, prismaError, seed
│       ├── scripts/               # raceTest, sendTestWebhook, checkConsistency
│       └── module/
│           ├── auth/ user/ property/ room/ application/ payment/ tenancy/ admin/     # Phase 1
│           ├── roommate/ viewing/ verification/ invoice/ utilityBill/
│           │   maintenance/ document/ notification/ owner/                          # Phase 2
│           └── cron/                                                                 # Phase 3
├── biome.json · tsconfig.json · tsup.config.ts · prisma.config.ts
└── .env.example · .gitignore · bun.lock · package.json
```

Each module folder contains `<feature>.route.ts` (`<Feature>Routes`), `<feature>.controller.ts` (`<Feature>Controller`), `<feature>.service.ts` (`<Feature>Services`), `<feature>.validation.ts` (`…ValidationZodSchema`) and `<feature>.interface.ts` (`I…Payload`).

---


## 👤 Author

**<Sakebul islam>** Sakebul islam --> Student ID: L2B7-0336 · `https://github.com/sakebul-islam/`
