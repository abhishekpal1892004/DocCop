# MediBook Backend

Production-oriented backend for **MediBook**, a Doctor Appointment Management System (MERN). This is **Phase 1: Backend Foundation** — a modular monolith with config, error handling, security middleware and health checks. **Phase 2** adds Clerk authentication, a MongoDB user model, role-based access control and Clerk webhooks. Further modules (patients, doctor onboarding, appointments, …) come in later phases.

## Tech stack

Node.js (ES Modules) · Express 5 · MongoDB Atlas + Mongoose · Zod · Helmet · cors · express-rate-limit · Morgan · dotenv · node:test + Supertest · nodemon (dev)

## Folder structure

```text
src/
├── config/        env.js (Zod-validated env), database.js (Mongoose)
├── modules/
│   └── health/    health.routes.js, health.controller.js, health.service.js
├── routes/        index.js (mounts module routers under /api/v1)
├── middleware/    error, notFound, requestLogger, rateLimiter, validate (Zod)
├── utils/         ApiError, ApiResponse, asyncHandler
├── app.js         Express app (no listening; testable)
└── server.js      DB connect → listen → graceful shutdown
tests/             node:test + Supertest (no real MongoDB required)
postman/           Postman collection for the health APIs
```

New feature = new folder in `src/modules/<name>/` (routes, controller, service, model, validation) mounted in `src/routes/index.js`.

## Installation

```bash
npm install
cp .env.example .env     # Windows: copy .env.example .env
```

## Environment

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | no (development) | `development`, `test`, `production` |
| `PORT` | no (5000) | HTTP port |
| `MONGODB_URI` | **yes** | MongoDB connection string |
| `CLIENT_ORIGINS` | no | Comma-separated allowed frontend origins; `*` is rejected |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | no | Rate limit window (15 min) / max requests (100) |
| `TRUST_PROXY` | no | Set (e.g. `1`) when behind a reverse proxy |

The app exits at startup with a clear message if validation fails. Never commit `.env`.

## MongoDB Atlas

1. Create a free cluster at <https://cloud.mongodb.com>.
2. **Database Access** → add a database user (username + password).
3. **Network Access** → allow your IP (avoid `0.0.0.0/0` outside quick tests).
4. **Connect → Drivers** → copy the `mongodb+srv://` string, set the user, password (URL-encode special characters) and database name:
   ```env
   MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/medibook?retryWrites=true&w=majority
   ```
5. Put it in `.env` only. A local MongoDB (`mongodb://127.0.0.1:27017/medibook`) also works.

## Run

```bash
npm run dev     # nodemon
npm start       # production
```

The server starts listening only after MongoDB connects; otherwise it exits with code 1. SIGINT/SIGTERM close the HTTP server and the DB connection gracefully.

## API (prefix `/api/v1`)

| Method | Path | Description |
|---|---|---|
| GET | `/health/live` | 200 while the process is alive |
| GET | `/health/ready` | 200 if MongoDB is connected, 503 otherwise |

Success: `{ "success": true, "message": "...", "data": {} }`
Error: `{ "success": false, "message": "...", "code": "NOT_FOUND" }` (validation errors add `details`; stack traces only outside production, never for 4xx).

Import [postman/MediBook.postman_collection.json](postman/MediBook.postman_collection.json) into Postman (`baseUrl` variable).

## Tests

```bash
npm test
```

Covers liveness, readiness (503 and 200 via simulated DB state), 404, CORS, and centralized error handling (ApiError, Zod, Mongoose validation, CastError, duplicate key, malformed JSON). No MongoDB Atlas connection is needed.

---

# Phase 2: Clerk Authentication & User Management

**Clerk authenticates; MongoDB is the source of truth for MediBook roles and account status.** There is no password system in Express.

## Clerk setup

1. Create an application at <https://dashboard.clerk.com> and enable the sign-in methods you want (email, phone, social).
2. **API keys** page: copy the *Publishable key* (`pk_...`) and *Secret key* (`sk_...`) into the backend `.env` as `CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY`.
3. **Webhooks** → Add endpoint → URL `https://<your-host>/api/v1/webhooks/clerk`, subscribe to `user.updated` and `user.deleted`, then copy the *Signing secret* (`whsec_...`) into `CLERK_WEBHOOK_SIGNING_SECRET`. For local development expose port 5000 with a tunnel (e.g. ngrok) or use the Clerk Dashboard's "Send example" with a tunnel.
4. The server refuses to start if the publishable/secret keys are missing. Never commit `.env`; `CLERK_SECRET_KEY` must never reach the frontend.

Backend env (see `.env.example`): `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`; optional `CLERK_JWT_KEY` (PEM public key for networkless verification). Frontend env (React/Vite app): `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_API_BASE_URL=http://localhost:5000`.

## Roles

| Role | Assigned by | Notes |
|---|---|---|
| `PATIENT` | Public onboarding | |
| `DOCTOR` | Public onboarding | Starts `onboardingStatus: NOT_STARTED`; not verified/approved/searchable until Phase 3 |
| `ADMIN` | **Server-side script only** | Never via API |

Rules enforced in code: roles are read from MongoDB, never from request bodies, headers or Clerk `unsafeMetadata`; `PATCH /users/me` rejects (400) any protected field; onboarding cannot change an existing role (409).

## User schema (`src/modules/users/user.model.js`)

`clerkUserId` (unique, immutable), `firstName`, `lastName`, `fullName`, `email` (lower-cased), `profileImage`, `phoneNumber` (E.164), `role`, `accountStatus` (`ACTIVE|SUSPENDED|DEACTIVATED`), `onboardingStatus` (`NOT_STARTED|IN_PROGRESS|COMPLETED|PENDING_VERIFICATION|APPROVED|REJECTED`), `isEmailVerified`, `preferences{language,timezone}`, `lastLoginAt`, timestamps; internal: `clerkUpdatedAt` (event ordering), `deletedAt`. Indexes: unique `clerkUserId`, `email`, `{role, accountStatus}`. No passwords or Clerk secrets are stored.

## Middleware (`src/middleware/auth.middleware.js`)

- `clerkAuth` – `clerkMiddleware()`; verifies the session token (no manual JWT decoding).
- `requireAuth` – 401 `UNAUTHENTICATED` unless Clerk verified a session; sets `req.identity`.
- `requireActiveAccount` – loads the MongoDB user; 403 `ONBOARDING_REQUIRED`, `ACCOUNT_SUSPENDED` or `ACCOUNT_DEACTIVATED`; sets `req.currentUser`.
- `requireRole(...roles)` – active account + role check; 403 `INSUFFICIENT_ROLE`.

```js
router.get('/admin-only', requireAuth, requireRole('ADMIN'), controller);
```

## API (prefix `/api/v1`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/users/onboard` | session | Body `{ "accountType": "PATIENT" \| "DOCTOR" }`. Identity fetched from Clerk server-side. 201 created, 200 already exists, 409 `ROLE_CONFLICT`, 400 for `ADMIN`/invalid |
| GET | `/users/me` | session | Own profile; 404 `ONBOARDING_REQUIRED` if no MongoDB record. Readable by suspended users so clients can show a message |
| PATCH | `/users/me` | session + ACTIVE | `firstName`, `lastName`, `phoneNumber`, `preferences{language,timezone}` only (strict) |
| POST | `/webhooks/clerk` | Svix signature | `user.updated`, `user.deleted`; other events acknowledged and ignored |

## Flows

- **Patient signup**: Clerk sign-up → call `POST /users/onboard {accountType:"PATIENT"}` with the session token → store returned profile → redirect to patient dashboard.
- **Doctor signup**: same with `"DOCTOR"` → redirect to doctor onboarding (Phase 3). The doctor is *not* approved.
- **Login**: Clerk sign-in → `GET /users/me`; 404 `ONBOARDING_REQUIRED` → onboard; otherwise redirect by backend `role`/`accountStatus`/`onboardingStatus`.

> **Frontend:** no React app existed in this workspace, so only the backend half is implemented. A frontend must use `@clerk/react` (`ClerkProvider`, `useAuth().getToken()`) and send `Authorization: Bearer <token>`.

## Webhooks

Mounted before `express.json()` with a raw body; signatures are verified with `verifyWebhook` (Svix; replays older than ~5 min are rejected). Invalid signature → 400; processing failure → 5xx so Clerk retries. `user.updated` syncs only `email`, `isEmailVerified`, `profileImage`, and only if the event is newer than the last applied one (duplicates / out-of-order events are no-ops). Names and phone are edited in MediBook and not overwritten. Roles/status are never touched. `user.deleted` **soft-deactivates** (`accountStatus: DEACTIVATED`, `deletedAt`) so future appointments/records remain intact. Onboarding never depends on webhooks.

## Admin provisioning

Admins are created only by a trusted operator with server access:

1. The person signs up normally in Clerk (any method) and you copy their Clerk user id (`user_...`) from Dashboard → Users.
2. On the server with production env loaded:
   ```bash
   npm run provision:admin -- user_2abc123 --confirm
   ```
   The script verifies the Clerk account exists, then sets `role: ADMIN` / `ACTIVE` in MongoDB. There is no HTTP endpoint for this.

## Testing authentication with Postman

1. Get a session token: in a signed-in frontend run `await window.Clerk.session.getToken()` in the browser console (tokens live ~60 s), or in Clerk Dashboard → *Users* → user → *Impersonate*. For a sign-in-token flow see Clerk docs.
2. Import `postman/MediBook.postman_collection.json`, set `baseUrl` and `token`.
3. Requests send `Authorization: Bearer <CLERK_SESSION_TOKEN>`.
4. Try: `POST /users/onboard` → `GET /users/me` → `PATCH /users/me` (also try `{"role":"ADMIN"}` → expect 400).

## Automated tests

`npm test` (51 tests, no Clerk or MongoDB credentials needed): session tokens are signed with a locally generated key and verified by the real Clerk middleware via `CLERK_JWT_KEY`; the Clerk API and user repository are replaced with mocks/in-memory fakes; webhooks are signed with real Svix-compatible HMACs. The real MongoDB repository queries and live Clerk calls are **not** covered by the suite.


---

# Phase 3: Patient Profiles, Doctor Onboarding, NMC Verification & Admin Review

Phase 3 completes the onboarding and verification lifecycle for **patients** and **doctors**, adds **admin review & approval**, and exposes the **verified doctor directory**.

## Modules & Endpoints (prefix `/api/v1`)

### Patients (`src/modules/patients/`)
All routes require `requireAuth` + `requireRole('PATIENT')`.
- `POST /patients/profile` – Create patient profile (`onboardingStatus` → `COMPLETED`)
- `GET /patients/me` – Retrieve own patient profile
- `PATCH /patients/me` – Update permitted patient profile fields

### Doctor Applications (`src/modules/doctorApplications/`)
Doctor-facing routes require `requireAuth` + `requireRole('DOCTOR')`:
- `POST /doctor-applications` – Create draft application (`onboardingStatus` → `IN_PROGRESS`)
- `GET /doctor-applications/me` – Retrieve own application
- `PATCH /doctor-applications/me` – Update draft (or `NEEDS_INFORMATION`) application; changing registration details invalidates prior NMC lookups
- `POST /doctor-applications/submit` – Validate completeness + NMC lookup and submit (`SUBMITTED`, `onboardingStatus` → `PENDING_VERIFICATION`)
- `GET /doctor-applications/status` – Current onboarding/application/NMC/GST status summary

### Doctor Verification / NMC (`src/modules/doctorVerification/`)
Requires `requireAuth` + `requireRole('DOCTOR')` (rate-limited):
- `GET /doctor-verification/nmc-states` – Supported NMC state council codes
- `POST /doctor-verification/nmc-check` – Run NMC lookup (non-allopathic systems route to `MANUAL_REVIEW_REQUIRED`)

### Admin Doctor Review (`src/modules/doctorApplications/adminDoctorApplication.routes.js`)
Requires `requireAuth` + `requireRole('ADMIN')`:
- `GET /admin/doctor-applications` – List & filter applications (`status`, `nmcVerificationStatus`, `page`, `limit`)
- `GET /admin/doctor-applications/:id` – Full application details + recent NMC lookup history
- `POST /admin/doctor-applications/:id/review` – Body `{ "action": "START_REVIEW" | "REQUEST_INFO" | "APPROVE" | "REJECT", "notes"?, "reason"? }`:
  - `START_REVIEW`: `SUBMITTED` → `UNDER_REVIEW`
  - `REQUEST_INFO`: `SUBMITTED` / `UNDER_REVIEW` → `NEEDS_INFORMATION` (sets `User.onboardingStatus` → `IN_PROGRESS` so the doctor can edit & re-submit)
  - `APPROVE`: `SUBMITTED` / `UNDER_REVIEW` → `APPROVED` (sets `User.onboardingStatus` → `APPROVED` and creates/updates the verified `Doctor` record)
  - `REJECT`: `SUBMITTED` / `UNDER_REVIEW` → `REJECTED` (sets `User.onboardingStatus` → `REJECTED`)

### Verified Doctors (`src/modules/doctors/`)
- `GET /doctors` – Public searchable directory of verified, accepting doctors (`specialization`, `city`, `state`, `medicalSystem`, `q`, `page`, `limit`)
- `GET /doctors/:id` – Public verified doctor profile
- `GET /doctors/me` – Verified doctor's own profile (`DOCTOR` role)
- `PATCH /doctors/me` – Update practice fields only (`consultationFee`, `bio`, `languages`, `isAcceptingPatients`)


---

# Phase 4: Doctor Verification, Clinic Management & Admin Approval System

Phase 4 adds granular verification workflows (**professional registration**, **clinic & doctor-clinic association**, **optional GST**), **admin dashboard & review APIs**, **doctor approval & publication (`Doctor.profileStatus = PUBLISHED`)**, **doctor suspension/reactivation**, and **append-only audit logging**.

## New & Extended Modules

- `src/modules/auditLogs/` – Append-only `AuditLog` model and service (no update/delete APIs).
- `src/modules/clinics/` – `Clinic` and `DoctorClinicAssociation` models, doctor association endpoints (`/api/v1/clinics/verified`, `/api/v1/clinics/associations`), and admin clinic verification.
- `src/modules/doctorVerification/` – `DoctorVerification` model (separate `professional`, `clinic`, and `gst` tracks) + `buildNmcSideBySideComparison` (never invents missing NMC fields; reports `NOT_AVAILABLE`).
- `src/modules/admin/` – Admin dashboard, application review, granular verification endpoints, approval/rejection, doctor suspension, clinic management, and audit logs.
- `src/modules/doctors/` – Public directory (`GET /api/v1/doctors`, `GET /api/v1/doctors/:id`) strictly filters `isVerified: true` and `profileStatus: 'PUBLISHED'`.

## Admin APIs (prefix `/api/v1/admin`, `ADMIN` role required)

| Method | Path | Description |
|---|---|---|
| GET | `/dashboard` | Aggregated counts (patients, doctors, pending/rejected applications, clinics) |
| GET | `/doctor-applications` | Paginated queue (`status`, `state`, `nmcVerificationStatus`, `q`, `sortOrder`) |
| GET | `/doctor-applications/:id` | Full application, `DoctorVerification`, side-by-side NMC comparison, lookups, clinic associations |
| PATCH | `/doctor-applications/:id/review` | Transition `SUBMITTED` → `UNDER_REVIEW` |
| PATCH | `/doctor-applications/:id/professional-verification` | Record professional verification (`VERIFIED`, `NEEDS_CORRECTION`, `REJECTED`, `UNABLE_TO_VERIFY`) |
| PATCH | `/doctor-applications/:id/clinic-verification` | Record clinic verification (`VERIFIED`, `NEEDS_CORRECTION`, `REJECTED`, `NOT_APPLICABLE`) |
| PATCH | `/doctor-applications/:id/gst-verification` | Record manual GST verification against the official GST portal |
| POST | `/doctor-applications/:id/request-information` | Set `NEEDS_INFORMATION` with `remarks` & `fieldsToCorrect` |
| POST | `/doctor-applications/:id/approve` | Enforce all approval rules, publish `Doctor`, set `APPROVED`, record audit log |
| POST | `/doctor-applications/:id/reject` | Set `REJECTED` with mandatory `reason`, record audit log |
| GET | `/doctors` | List approved/suspended doctor profiles |
| PATCH | `/doctors/:id/status` | Suspend or reactivate doctor (`PUBLISHED` \| `SUSPENDED`) with mandatory `reason` |
| GET / PATCH / POST | `/clinics`, `/clinics/:id/verify`, `/clinics/:id/doctors` | Manage & verify clinics and doctor-clinic associations |
| GET | `/audit-logs` | Read-only paginated audit trail |


---

# Phase 5: Doctor Management, Public Doctor Directory, Calendly Integration & Appointment Management

Phase 5 enables approved doctors to manage their public profiles, connect personal Calendly accounts via **OAuth 2.1 + PKCE (S256)**, map internal **AppointmentTypes**, expose live Calendly availability, and let patients book, cancel, and reschedule appointments synchronized by Calendly webhooks.

## Environment Variables (`.env.example`)
- `CALENDLY_CLIENT_ID` / `CALENDLY_CLIENT_SECRET`
- `CALENDLY_REDIRECT_URI` (default `http://localhost:5000/api/v1/integrations/calendly/callback`)
- `CALENDLY_WEBHOOK_SIGNING_KEY` (HMAC-SHA256 signing key for `Calendly-Webhook-Signature`)
- `CALENDLY_TOKEN_ENCRYPTION_KEY` (64-hex-char 32-byte key or passphrase for AES-256-GCM encryption of stored OAuth tokens and cancel/reschedule URLs)

## Required Calendly OAuth Scopes
`users:read`, `event_types:read`, `availability:read`, `scheduled_events:read`, `scheduled_events:write`, `webhooks:write`.

## APIs (prefix `/api/v1`)

### Doctor Management & Appointment Types (`DOCTOR`, approved & `PUBLISHED`)
- `GET /doctors/me/profile`, `PATCH /doctors/me/profile`
- `GET /doctors/me/clinics`, `GET /doctors/me/status`
- `GET /doctors/me/appointment-types`, `POST /doctors/me/appointment-types`, `PATCH /doctors/me/appointment-types/:id`, `PATCH /doctors/me/appointment-types/:id/status`

### Public Doctor Directory & Availability
- `GET /doctors` – Filters: `search`, `specialization`, `city`, `clinic`, `minFee`, `maxFee`, `minExperience`, `consultationMode`, `sortBy` (`experience|fee_asc|fee_desc|newest`), `page`, `limit`
- `GET /doctors/:id` – Public profile + verified clinics + active appointment types
- `GET /doctors/:id/availability` – Query: `appointmentTypeId`, `startDate`, `endDate`, `timezone` (splits >31-day ranges into valid Calendly chunks; formats `displayTime` in the requested IANA timezone)

### Calendly OAuth & Event Types (`/integrations/calendly`)
- `GET /integrations/calendly/connect` (`DOCTOR`) – Generates CSRF `state` + PKCE `code_challenge` (`S256`)
- `GET /integrations/calendly/callback` – Validates `state`, exchanges code with `code_verifier`, encrypts tokens
- `GET /integrations/calendly/status`, `GET /integrations/calendly/event-types`, `POST /integrations/calendly/event-types/sync`, `POST /integrations/calendly/event-types/select`, `DELETE /integrations/calendly/disconnect`

### Appointments & Webhooks
- `POST /appointments` (`PATIENT`, requires `Idempotency-Key` header) – Books via Calendly `POST /invitees`; handles `409 SLOT_UNAVAILABLE` and timeouts (`504 BOOKING_RECONCILIATION_REQUIRED`)
- `GET /appointments/my` (`PATIENT`, `tab=upcoming|past|cancelled|rescheduled|all`)
- `GET /doctor/appointments` (`DOCTOR`)
- `GET /appointments/:id`, `POST /appointments/:id/cancel`, `POST /appointments/:id/reschedule` (returns Calendly `rescheduleUrl` without marking `RESCHEDULED` prematurely)
- `POST /webhooks/calendly` – Raw-body HMAC-SHA256 `Calendly-Webhook-Signature` verification, replay check, `CalendlyWebhookEvent` inbox deduplication, and `invitee.created` / `invitee.canceled` (including `old_invitee` / `new_invitee` reschedule linkage)


---

# Phase 6: Twilio Notification Management (SMS, WhatsApp & Appointment Reminders)

Phase 6 adds privacy-safe appointment notifications (**confirmations**, **24h & 2h reminders**, **cancellations**, and **reschedules**) via **Twilio Programmable SMS**, **Twilio WhatsApp Content Templates**, and **in-app notifications**, backed by a **MongoDB + `node-cron`** scheduler.

## Twilio & Scheduler Environment Variables (`.env.example`)
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`
- `TWILIO_MESSAGING_SERVICE_SID`, `TWILIO_SMS_FROM_NUMBER`
- `TWILIO_WHATSAPP_FROM` (e.g. `whatsapp:+14155238886` for Sandbox)
- `TWILIO_CONTENT_SID_APPOINTMENT_CONFIRMED`, `TWILIO_CONTENT_SID_APPOINTMENT_REMINDER`, `TWILIO_CONTENT_SID_APPOINTMENT_CANCELLED`, `TWILIO_CONTENT_SID_APPOINTMENT_RESCHEDULED`
- `TWILIO_STATUS_CALLBACK_URL` (e.g. `https://<host>/api/v1/webhooks/twilio/status`)
- `TWILIO_WHATSAPP_SANDBOX_ENABLED`, `TWILIO_DLT_ENTITY_ID`, `TWILIO_DLT_SENDER_ID`
- `NOTIFICATION_SCHEDULER_ENABLED`, `NOTIFICATION_WORKER_INTERVAL_SECONDS`, `NOTIFICATION_MAX_ATTEMPTS`, `NOTIFICATION_RETRY_BASE_SECONDS`

## India SMS (DLT) & WhatsApp Templates
- **India Domestic SMS**: Requires DLT entity registration, approved Sender ID, and whitelisted SMS templates in Twilio/DLT portals; never use shortened URLs in Indian SMS.
- **WhatsApp Business**: Out-of-session notifications require approved **Content Templates** in Twilio Console (`ContentSid` + JSON `ContentVariables`, never combining `Body` with `ContentSid`). Development can use the Twilio WhatsApp Sandbox.
- **Scheduler**: Uses atomic `findOneAndUpdate` leases (`lockUntil`) in MongoDB without Redis/BullMQ; suitable for current scale and replaceable with a dedicated queue at higher volume.

## APIs (prefix `/api/v1`)
- `GET /notifications/my` – In-app notification history + `unreadCount`
- `PATCH /notifications/:id/read` – Mark one in-app notification as read
- `PATCH /notifications/read-all` – Mark all delivered in-app notifications as read
- `GET /notifications/preferences`, `PATCH /notifications/preferences` – Independent SMS/WhatsApp opt-in consent & E.164 phone management
- `POST /webhooks/twilio/status` – Form-urlencoded Twilio delivery status callback validated with `X-Twilio-Signature` (`twilio.validateRequest`)


---

# Phase 7: Medical Records, Digital Prescriptions, Consultations, Analytics & Production Readiness

Phase 7 completes the MediBook backend with encrypted **MongoDB GridFS** medical records, immutable **digital prescriptions** with **PDF** generation, **consultation records**, **MongoDB aggregation analytics**, **security hardening**, and **DevOps/CI** artifacts.

## New Modules & Endpoints (prefix `/api/v1`)

### Medical Records (`src/modules/medicalRecords/`)
- `POST /medical-records` (`PATIENT` / `DOCTOR`, multipart `file`, max 10 MB, magic-byte verified `PDF/JPG/PNG`, AES-256-GCM encrypted in GridFS)
- `GET /medical-records/my` (`PATIENT`), `GET /medical-records/:id`, `GET /medical-records/:id/download` (`X-Content-Type-Options: nosniff`, `attachment`), `PATCH /medical-records/:id`, `DELETE /medical-records/:id`
- `POST /medical-records/:id/share`, `DELETE /medical-records/:id/share/:doctorId`
- *Limitation*: `CLAMAV_SCAN_ENABLED` defaults to `false`; uploads are marked `UNSCANNED` (never falsely `CLEAN`) and require `allowUnscanned: true` to share.

### Digital Prescriptions (`src/modules/prescriptions/`)
- `POST /prescriptions` (`DOCTOR`), `GET /prescriptions/my` (`PATIENT`), `GET /doctor/prescriptions` (`DOCTOR`)
- `GET /prescriptions/:id`, `PATCH /prescriptions/:id` (drafts only; issued prescriptions are immutable)
- `POST /prescriptions/:id/issue` (atomic `MB-RX-YYYY-000001` sequence), `POST /prescriptions/:id/amend`, `POST /prescriptions/:id/void`, `GET /prescriptions/:id/pdf`

### Consultations (`src/modules/consultations/`) & Admin Analytics (`src/modules/analytics/`)
- `POST /consultations`, `PATCH /consultations/:id`, `POST /consultations/:id/complete`, `GET /consultations/my`, `GET /doctor/consultations`, `GET /consultations/:id`
- `GET /admin/analytics/overview`, `/appointments`, `/users`, `/doctors`, `/clinics` (`ADMIN`, max 366-day range)

## Deployment, Worker & CI
- **Dedicated Worker**: Run `npm run worker` (`src/workers/notification.worker.js`) with `NOTIFICATION_SCHEDULER_ENABLED=false` on API replicas.
- **Containers & CI**: [Dockerfile](Dockerfile), [.github/workflows/ci.yml](.github/workflows/ci.yml), [.env.development.example](.env.development.example), [.env.production.example](.env.production.example), and [SECURITY_AUDIT_REPORT.md](SECURITY_AUDIT_REPORT.md).
- **MongoDB Atlas Backup & Restore**: Enable automated Cloud Backups + Point-in-Time Recovery (M10+ clusters) in Atlas, keep dev/prod clusters separate, and periodically test snapshot restores to a staging cluster.


---

# Phase 8: Online Payments, Video Consultations, Doctor Reviews & Live Queue Management

Phase 8 adds **Razorpay Payments** (Stage 8A), **Agora RTC Video Consultations** (Stage 8B), **Doctor Reviews & Ratings with Admin Moderation** (Stage 8C), and **Live In-Person Clinic Queue Management** (Stage 8D).

## Environment Variables (`.env.example`)
- **Razorpay**: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RAZORPAY_CALLBACK_URL`, `RAZORPAY_PAYMENT_CURRENCY=INR`, `RAZORPAY_PAYMENT_TIMEOUT_MINUTES=10`, `PAYMENT_ENABLED=true`
- **Agora**: `AGORA_APP_ID`, `AGORA_APP_CERTIFICATE`, `AGORA_TOKEN_EXPIRY_SECONDS=3600`, `AGORA_ENABLED=true`, `VIDEO_CONSULTATION_ENABLED=true`
- **Feature Flags**: `REVIEWS_ENABLED=true`, `QUEUE_MANAGEMENT_ENABLED=true`

## APIs (prefix `/api/v1`)

### Stage 8A – Razorpay Payments (`src/modules/payments/`)
- `POST /payments/create-order` (`PATIENT`) – Derives amount in integer paise from DB (`AppointmentType.consultationFee`)
- `POST /payments/verify` (`PATIENT`) – Verifies HMAC-SHA256 `order_id|payment_id` against stored order ID + server-side Razorpay capture status, then confirms appointment and triggers Twilio notification
- `GET /payments/my`, `GET /payments/:id`, `POST /payments/:id/refund` (`PATIENT` / `ADMIN`)
- `POST /webhooks/razorpay` – Raw-body `X-Razorpay-Signature` verification + `x-razorpay-event-id` deduplication

### Stage 8B – Agora Video Consultations (`src/modules/videoConsultations/`)
- `POST /video-consultations/:appointmentId/token` (`PATIENT` / `DOCTOR`) – Verifies appointment, payment, doctor approval, online mode, join window, and telemedicine consent; issues short-lived Agora RTC token (App Certificate never exposed)
- `POST /video-consultations/:appointmentId/complete` (`DOCTOR`)

### Stage 8C – Doctor Reviews & Ratings (`src/modules/reviews/`)
- `POST /doctors/:id/reviews` (`PATIENT`, completed appointments only, 1 review per appointment)
- `GET /doctors/:id/reviews` (public: approved reviews + rating distribution)
- `GET /reviews/my`, `PATCH /reviews/:id`, `DELETE /reviews/:id`, `POST /reviews/:id/report`
- `GET /admin/reviews`, `PATCH /admin/reviews/:id/moderate` (`ADMIN`)

### Stage 8D – Live Clinic Queue Management (`src/modules/queueManagement/`)
- `POST /doctor/queues`, `GET /doctor/queues/current`, `PATCH /doctor/queues/:id/call-next`, `PATCH /doctor/queues/:id/entries/:entryId/{start|complete|skip}`, `PATCH /doctor/queues/:id/{pause|resume|close}` (`DOCTOR`)
- `POST /queues/check-in`, `GET /queues/my-position` (`PATIENT`, in-person confirmed appointments only; returns estimated wait time without exposing other patients' PII)

---

# Phase 10 – Multi-Clinic, Receptionist Portal, Waitlist, Follow-ups & Support

Phase 10 expands MediBook into a multi-clinic platform across backend Stages **10A–10E** (note: Stage 10F Progressive Web App is frontend-only and not present in this backend-only repository):

### Stage 10A – Multi-Clinic & Organization Management (`src/modules/organizations/`)
- `POST /organizations`, `GET /organizations/my`, `GET /organizations/:id`, `PATCH /organizations/:id`, `POST /organizations/:id/clinics` (`DOCTOR`, `CLINIC_MANAGER`, `ADMIN`)
- `GET /clinics/:id` (`requireAuth`, `requireActiveAccount`, scoped to creator, organization owner/manager, verified doctor, or active staff)

### Stage 10B – Receptionist & Clinic Staff Portal (`src/modules/staffManagement/`)
- `POST /clinics/:id/staff/invite`, `POST /clinics/:id/staff/accept`, `GET /clinics/:id/staff`, `PATCH /clinics/:id/staff/:staffId`, `DELETE /clinics/:id/staff/:staffId`
- `GET /staff/clinics` (`CLINIC_MANAGER`, `RECEPTIONIST`, `DOCTOR`)
- Staff roles (`RECEPTIONIST`, `CLINIC_MANAGER`) can manage queues and clinic appointments when permitted, and are strictly blocked from medical records and prescriptions.

### Stage 10C – Smart Appointment Waitlist (`src/modules/waitlist/`)
- `POST /waitlist`, `GET /waitlist/my`, `DELETE /waitlist/:id`, `POST /waitlist/offers/:offerId/accept` (`PATIENT`)
- Integrated with `calendlyWebhook.service.js` to revalidate slot availability via Calendly before issuing a time-bound waitlist offer (never auto-books without explicit patient acceptance).

### Stage 10D – Follow-up & Patient Engagement (`src/modules/followUps/`)
- `POST /follow-ups` (`DOCTOR` for own appointments), `GET /doctor/follow-ups` (`DOCTOR`), `GET /follow-ups/my` (`PATIENT`), `PATCH /follow-ups/:id/status`, `POST /follow-ups/:id/book` (`PATIENT`)

### Stage 10E – Patient Support & Complaint Management (`src/modules/support/`)
- `POST /support/tickets`, `GET /support/tickets/my`, `GET /support/tickets/:id`, `POST /support/tickets/:id/reply`
- `GET /admin/support/tickets`, `PATCH /admin/support/tickets/:id` (`ADMIN`, with internal note isolation & audit logging)

---

# Phase 11 – ABDM Integration, ABHA Linking & FHIR R4 Interoperability

Phase 11 prepares MediBook for participation in India's **Ayushman Bharat Digital Mission (ABDM)** ecosystem across backend Stages **11A–11E & 11G** (disabled by default via `ABDM_ENABLED=false` until NHA sandbox/production credentials and approvals are obtained; Stage 11F React UI is not present in this backend-only repository):

- **ABDM Integration Layer (`src/integrations/abdm/`)**: Gateway v3 session auth (`POST /api/hiecm/gateway/v3/sessions`), AES-256-GCM + SHA-256 identifier protection, and outbound gating when `ABDM_ENABLED=false`.
- **ABHA Optional Linking (`/api/v1/abdm/abha/*`)**: Voluntary `initiate-link`, `verify`, `status` (masked), and `unlink`; Clerk authentication remains independent.
- **HPR & HFR Registry Linking (`/api/v1/abdm/hpr/*`, `/api/v1/abdm/hfr/*`)**: Separate from Phase 4 NMC and statutory clinic verification.
- **FHIR R4 Interoperability (`/api/v1/interoperability/fhir/*`)**: NRCeS ABDM IG `ndhm.in#6.5.0` (FHIR `4.0.1`) mapping & validation for `Patient`, `Practitioner`, `Organization`, `Encounter`, `Composition`, `MedicationRequest`, `DiagnosticReport`, `DocumentReference`, and `Bundle`.
- **HIP (`/api/v1/abdm/hip/*`), HIU & Consent (`/api/v1/abdm/hiu/*`), Webhooks (`/api/v1/webhooks/abdm`), Admin Dashboard (`/api/v1/abdm/admin/dashboard`)**: Consent-enforced exchange, HMAC + timestamp replay protection, and event deduplication.
