# MediBook Disaster Recovery Plan

> **Note:** Proposed RPO and RTO values below are operational **targets** to be approved and validated via staging drills, not guarantees.

| Scenario | Proposed RPO Target | Proposed RTO Target | Recovery Procedure |
|---|---|---|---|
| **MongoDB Outage** | <= 15 min (M10+ PITR) / <= 24h (daily) | 30–60 min | Verify Atlas cluster status, failover primary, confirm `/api/v1/health/ready` returns `200`. |
| **Accidental Data Deletion** | <= 15 min (PITR) | 60 min | Restore to an **isolated staging/recovery cluster** first; validate counts; selectively recover affected records. Never overwrite production blindly. |
| **Failed App Deployment** | 0 | 5–10 min | Roll back container image tag (`medibook-api:<previous-sha>`) and verify `/health/live` & `/health/ready`. |
| **Background Worker Failure** | 0 (persisted in MongoDB) | 5 min | Restart `npm run worker`; expired leases auto-recover without duplicate sends. |
| **Compromised Credentials** | N/A | 15–30 min | Rotate affected Clerk/Razorpay/Twilio/Calendly/ABDM/Encryption keys in secret manager, invalidate tokens, audit `AuditLog`. |
| **External Provider Outage** | 0 | Graceful degradation | Circuit breaker (`src/utils/circuitBreaker.js`) and bounded timeouts isolate impact; bookings/records remain consistent. |
