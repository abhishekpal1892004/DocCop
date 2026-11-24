# ABDM Consent Management

- **Model (`AbdmConsent`):** Tracks `REQUESTED`, `PENDING`, `GRANTED`, `DENIED`, `REJECTED`, `EXPIRED`, `REVOKED`, `FAILED`.
- **Enforcement:** HIU data requests require `status === 'GRANTED'` and `expiresAt > now`. Doctors can only request consent for patients they have an appointment relationship with.
- **Immutability:** `REJECTED`, `DENIED`, and `REVOKED` consents cannot transition back to `GRANTED` via webhooks. Admins cannot override patient consent.
- **Revocation:** `POST /api/v1/abdm/hiu/consent/:id/revoke` blocks future external data requests while preserving audit history.
