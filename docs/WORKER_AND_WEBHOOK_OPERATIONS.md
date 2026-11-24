# MediBook Background Worker & Webhook Operations

## 1. MongoDB-Backed Background Worker (No Redis / BullMQ)
- **Process Separation:** API pods run with `RUN_EMBEDDED_WORKER=false`; dedicated worker containers run `npm run worker` (`src/workers/notification.worker.js`).
- **Atomic Claiming & Leases:** Notification jobs use MongoDB atomic `findOneAndUpdate` with `leaseOwner` and `leaseExpiresAt` so multiple worker instances never process the same job concurrently and crashed workers recover automatically once the lease expires.
- **Retry & Backoff:** Bounded by `NOTIFICATION_MAX_ATTEMPTS` and `NOTIFICATION_RETRY_BASE_SECONDS`.
- **Observability:** Each tick records `worker_ticks_total`, `worker_last_heartbeat_at`, and `worker_last_duration_ms` in `src/utils/metrics.js`.

## 2. Webhook Security & Idempotency
All external webhook handlers are mounted **before** `express.json()` in `src/app.js` to preserve raw request bodies for cryptographic signature verification:
- **Clerk (`/api/v1/webhooks/clerk`):** Svix signature + timestamp replay check + `WebhookEvent` deduplication.
- **Calendly (`/api/v1/webhooks/calendly`):** HMAC-SHA256 signature + replay window + `CalendlyWebhookEvent` deduplication.
- **Razorpay (`/api/v1/webhooks/razorpay`):** `X-Razorpay-Signature` HMAC-SHA256 + `x-razorpay-event-id` deduplication.
- **Twilio (`/api/v1/webhooks/twilio`):** `X-Twilio-Signature` validation.
- **ABDM (`/api/v1/webhooks/abdm`):** `x-abdm-signature` HMAC-SHA256 + 5-minute `x-abdm-timestamp` replay window + `AbdmWebhookEvent` deduplication + inbound FHIR bundle validation.
