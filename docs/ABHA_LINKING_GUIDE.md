# ABHA Identity Linking Guide

1. **Initiate Link:** `POST /api/v1/abdm/abha/link/initiate` (or `/initiate-link`) with `abhaNumber` or `abhaAddress`. Checks SHA-256 hash to prevent duplicate linking across accounts.
2. **Verify OTP:** `POST /api/v1/abdm/abha/link/verify` (or `/verify`). Never stores OTPs; encrypts verified identifiers with AES-256-GCM (`abdmCrypto`) and stores masked values (`XX-XXXX-XXXX-9012`, `pa***@sbx`).
3. **Status:** `GET /api/v1/abdm/abha/status` returns masked status (`NOT_LINKED` by default).
4. **Unlink:** `DELETE /api/v1/abdm/abha/link` (or `/unlink`) revokes the link and clears encrypted identifiers without affecting Clerk login or MediBook records.
