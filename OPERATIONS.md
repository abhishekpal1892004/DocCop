# MediBook Operations & Monitoring Guide

## 1. Health & Readiness Monitoring
- Poll `GET /api/v1/health/live` (process liveness) and `GET /api/v1/health/ready` (MongoDB connectivity: 200 vs 503).
- Alert on sustained 5xx responses, readiness failures, or worker process exits.

## 2. Logging & Correlation
- Every HTTP request carries `X-Request-Id` (`req.id`) and UTC timestamps.
- Never log patient diagnoses, prescriptions, medical document contents, Clerk/Calendly/Twilio tokens, or encryption keys.
- Retain ICT/security logs for at least **180 days** within Indian jurisdiction (CERT-In readiness) and maintain a **6-hour** incident reporting escalation runbook.

## 3. External Integration Monitoring
- **Twilio**: Monitor `FAILED` / `UNDELIVERED` / `UNKNOWN` notification counts in `notifications` collection.
- **Calendly**: Monitor `REQUIRES_RECONCILIATION` appointments and `FAILED` entries in `calendlywebhookevents`.
- **GridFS Storage**: Monitor `medicalDocuments.chunks` storage growth in MongoDB Atlas.
