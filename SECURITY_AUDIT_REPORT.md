# MediBook Security Audit & Compliance Readiness Report

## 1. Scope of Review
Backend Modular Monolith (`src/`) covering Phases 1–7: Clerk authentication, RBAC, patient & doctor onboarding, NMC/clinic/GST verification, Calendly OAuth 2.1 + PKCE & webhooks, Twilio SMS/WhatsApp & status callbacks, MongoDB GridFS encrypted medical records, immutable digital prescriptions, consultations, admin analytics, and audit logging.

> **Disclaimer:** This report documents internal engineering controls and automated test evidence. It does **not** constitute an independent third-party penetration test or legal certification under India's Digital Personal Data Protection (DPDP) Act, 2023 / DPDP Rules, 2025 or CERT-In directions. Formal legal and security sign-off is required before commercial launch.

---

## 2. Controls Implemented & Verified

| Domain | Control | Implementation | Status |
|---|---|---|---|
| **Authentication** | Clerk JWT verification; no manual JWT decode | `src/middleware/auth.middleware.js` (`clerkMiddleware`) | Implemented & tested |
| **Authorization / IDOR** | MongoDB-backed roles & ownership checks on every resource | `requireRole`, `assertCanAccessMedicalRecord`, `assertAppointmentOwner`, `assertDoctorEligibleForAppointment` | Implemented & tested |
| **Input & NoSQL Injection** | Strict Zod schemas + `$` / `.` key stripping | `src/middleware/validate.middleware.js`, `src/middleware/sanitize.middleware.js` | Implemented & tested |
| **HTTP Hardening** | Helmet headers, strict CORS allowlist, `x-powered-by` disabled, 100 KB JSON limit, rate limiting | `src/app.js`, `src/middleware/rateLimiter.middleware.js` | Implemented & tested |
| **Medical Document Security** | Magic-byte signature check (`PDF/JPG/PNG`), 10 MB limit, AES-256-GCM key-versioned encryption, GridFS private bucket, `nosniff` + `attachment` headers | `documentEncryption.service.js`, `documentStorage.service.js`, `medicalRecord.controller.js` | Implemented & tested |
| **OAuth & Secret Storage** | Calendly OAuth 2.1 + PKCE (`S256`), CSRF `state`, AES-256-GCM encrypted tokens | `calendly.oauth.js`, `calendly.token.service.js` | Implemented & tested |
| **Webhooks** | Svix (Clerk), HMAC-SHA256 `Calendly-Webhook-Signature`, `twilio.validateRequest` (`X-Twilio-Signature`) | `clerk.webhook.js`, `calendlyWebhook.service.js`, `twilio.webhook.js` | Implemented & tested |
| **Audit Logging** | Append-only `AuditLog` with `actorUserId`, `actorRole`, `action`, `targetType`, `targetId`, `outcome`, `requestId` | `src/modules/auditLogs/` | Implemented & tested |

---

## 3. Remaining Findings & Operational Limitations

1. **Malware Scanning (Medium)**: `CLAMAV_SCAN_ENABLED` defaults to `false`; uploads are marked `UNSCANNED` (never falsely `CLEAN`) and blocked from doctor sharing unless `allowUnscanned: true` is explicitly passed. Wire a ClamAV daemon before production launch.
2. **Admin MFA (Operational)**: Enforce MFA for `ADMIN` accounts in the Clerk Dashboard.
3. **E-Prescription Legal Compliance (Operational)**: Generated PDFs include doctor attestation metadata and a disclaimer that they are not qualified cryptographic signatures. Review applicable telemedicine/e-prescription regulations prior to launch.
4. **DPDP Act 2023 / DPDP Rules 2025 & CERT-In Readiness**:
   - Consent tracking is implemented for SMS/WhatsApp; add UI privacy notices and legal retention schedules before launch.
   - `X-Request-Id` correlation and UTC timestamps are active; configure centralized log aggregation with 180-day retention in Indian jurisdiction and a 6-hour CERT-In incident reporting runbook.
5. **Frontend**: No React/Vite frontend exists in this repository; CSP and browser-side Clerk checks must be verified when the frontend is deployed.
