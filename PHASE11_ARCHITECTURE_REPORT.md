# MediBook Phase 11 – ABDM Architecture Report

**Status:** `COMPLETED_WITH_LIMITATIONS`

## 1. Architectural Overview
Phase 11 adds modular ABDM interoperability without modifying or duplicating MediBook's existing Clerk authentication, MongoDB GridFS medical document storage, or Phase 4 statutory doctor/clinic verification workflows.

### Core Layers
1. **Integration Layer (`src/integrations/abdm/`)**:
   - `abdm.config.js`: Reads `ABDM_ENABLED`, `ABDM_ENVIRONMENT`, `ABDM_BASE_URL` (`https://dev.abdm.gov.in`), `ABDM_ABHA_BASE_URL` (`https://abhasbx.abdm.gov.in`), `ABDM_CM_ID` (`sbx`), `ABDM_INTEGRATION_ROLE`, and `ABDM_FACILITY_ID`.
   - `abdm.auth.js` & `abdm.token.service.js`: Implements ABDM v3 Gateway session authentication (`POST /api/hiecm/gateway/v3/sessions`) with `REQUEST-ID`, `TIMESTAMP`, and `X-CM-ID` headers and short-lived in-memory token caching.
   - `abdm.client.js`: Enforces `ABDM_ENABLED=true` and configured credentials before any outbound HTTP call (`503 ABDM_EXTERNAL_DISABLED` otherwise).
   - `abdm.crypto.js`: AES-256-GCM encryption/decryption for ABHA identifiers, SHA-256 normalization hashing for duplicate detection, and UI/API masking helpers.
2. **Domain & Persistence Layer (`src/modules/abdm/`)**:
   - Models: `AbdmConnection`, `AbhaLink`, `RegistryLink` (HPR/HFR), `AbdmConsent`, `AbdmExchange` (HIP & HIU separated), `AbdmWebhookEvent`.
   - Services: `abha.service.js`, `hpr.service.js`, `hfr.service.js`, `hip.service.js`, `hiu.service.js`, `consent.service.js`, `abdmWebhook.service.js`.
3. **FHIR R4 Interoperability (`src/modules/interoperability/fhir/`)**:
   - Transforms MediBook `PatientProfile`, `Doctor`, `Clinic`, `Consultation`, `Prescription`, and `MedicalRecord` documents into NRCeS ABDM IG `ndhm.in#6.5.0` (FHIR `4.0.1`) `Bundle` documents and validates structure, profiles, coding systems, and references.
4. **Webhook Inbox (`src/webhooks/abdm.webhook.js`)**:
   - Mounted before `express.json()` in `src/app.js` to preserve raw body for HMAC-SHA256 verification, replay window validation, and MongoDB-backed event deduplication.

## 2. Limitations
- **Stage 11F (Frontend & Admin Dashboard UI):** Not implemented because this workspace is backend-only (no React/Vite frontend codebase exists). Backend APIs for patient ABHA/HIU/Consent, doctor HPR, clinic HFR, and `GET /api/v1/abdm/admin/dashboard` are ready.
- **External Connectivity:** Live ABDM sandbox/production calls remain disabled (`ABDM_ENABLED=false`) until official NHA sandbox credentials, milestone testing (M1/M2/M3), and production approvals are obtained.
