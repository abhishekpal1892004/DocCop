# MediBook Phase 11 – Security & Privacy Report

**Status:** `COMPLETED_WITH_LIMITATIONS`

## 1. Privacy & Security Controls Implemented

1. **Identity & Authentication Separation**
   - Clerk remains the sole authentication provider for MediBook. ABHA is optional and never replaces Clerk or gates core appointment/record workflows.
   - `ABHA_NUMBER` and `ABHA_ADDRESS` are encrypted at rest with AES-256-GCM (`abdmCrypto`) and hashed with SHA-256 for duplicate-account prevention.
   - API responses return only masked identifiers (`XX-XXXX-XXXX-9012`, `pa***@sbx`). OTPs and raw secrets are never persisted.

2. **Consent-Driven Exchange & Ownership Isolation**
   - HIU data requests (`POST /api/v1/abdm/hiu/data-request`) are blocked (`403`) unless the referenced `AbdmConsent` is `GRANTED` and not expired or `REVOKED`.
   - Doctors can only request HIU consent for patients with whom they have an existing MediBook appointment relationship (`403 FORBIDDEN` verified for unrelated doctors).
   - Patient consent revocation (`POST /api/v1/abdm/hiu/consent/:id/revoke`) immediately blocks future HIU data requests while preserving audit history.
   - FHIR conversion and retrieval routes enforce strict patient/treating-doctor ownership.

3. **Registry Integrity**
   - HPR and HFR linking records are stored separately in `RegistryLink` (`adminReviewStatus: 'PENDING'`) and never auto-approve Phase 4 `Doctor` or `Clinic` statutory verification.

4. **Webhook & External Gateway Hardening**
   - `abdmClient` blocks all outbound ABDM network calls with `503 ABDM_EXTERNAL_DISABLED` when `ABDM_ENABLED=false`.
   - `POST /api/v1/webhooks/abdm` verifies `x-abdm-signature` (HMAC-SHA256 over `timestamp.rawBody`), rejects timestamps outside a 5-minute replay window (`401 REPLAY_DETECTED`), deduplicates `eventId` in MongoDB, and validates inbound FHIR bundles before marking exchanges `COMPLETED`.
   - All ABHA, HPR, HFR, HIP, HIU, Consent, and Webhook events are recorded in `AuditLog` without logging raw sensitive PHI or FHIR payloads.
