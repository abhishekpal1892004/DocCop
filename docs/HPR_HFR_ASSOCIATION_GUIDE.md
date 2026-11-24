# HPR & HFR Association Guide

- **HPR (Doctors):** `POST /api/v1/abdm/hpr/search`, `POST /api/v1/abdm/hpr/link`, `GET /api/v1/abdm/hpr/status`.
- **HFR (Clinics):** `POST /api/v1/abdm/hfr/search`, `POST /api/v1/abdm/hfr/link`, `GET /api/v1/abdm/hfr/status`.
- **Admin Review:** `PATCH /api/v1/abdm/admin/registry/:id/review` (`APPROVED` | `REJECTED`).
- **Compliance Rule:** HPR/HFR associations never auto-approve Phase 4 NMC or statutory clinic verification.
