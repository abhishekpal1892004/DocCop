# ABDM Security & Privacy

- **Encryption:** AES-256-GCM (`abdmCrypto`) for `abhaNumberEncrypted` / `abhaAddressEncrypted`; SHA-256 hash for duplicate detection.
- **Masking & Redaction:** Responses return masked ABHA strings only; `logger.js` redacts ABHA, OTP, token, and clinical fields.
- **Webhooks:** `POST /api/v1/webhooks/abdm` verifies `x-abdm-signature` HMAC-SHA256, enforces a 5-minute `x-abdm-timestamp` replay window, and deduplicates `eventId` in `AbdmWebhookEvent`.
- **Audit Trail:** All ABHA, HPR, HFR, HIP, HIU, Consent, and Webhook events are logged to `AuditLog`.
