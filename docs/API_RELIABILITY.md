# MediBook API Performance & Reliability

## 1. Timeouts, Rate Limits & Payload Guards
- **HTTP Request Timeout:** `REQUEST_TIMEOUT_MS` (default `30000` ms) in `src/app.js` returns `504 REQUEST_TIMEOUT` on stalled requests.
- **External API Timeouts:** Bounded timeouts enforced on NMC (`NMC_TIMEOUT_MS=10000`), Calendly (`CALENDLY_TIMEOUT_MS=10000`), and ABDM (`ABDM_REQUEST_TIMEOUT_MS=15000`).
- **Rate Limiting & Payload Size:** `express-rate-limit` on `/api/v1` and `express.json({ limit: '100kb' })` (`200kb` raw body for webhooks).

## 2. Provider Outage Isolation & Circuit Breaker (`src/utils/circuitBreaker.js`)
- **Calendly:** Uncertain booking responses are never marked confirmed; webhook reconciliation and availability revalidation protect appointment state.
- **Twilio:** Notification acceptance (`queued`/`sent`) is tracked separately from delivery status callbacks; notification failures never roll back or corrupt confirmed bookings.
- **Razorpay:** Payments are only marked captured/verified after HMAC-SHA256 signature verification and server-side order/payment checks.
- **Agora:** App Certificate remains server-side only; short-lived RTC tokens are issued only after appointment, payment, mode, and consent checks.
- **ABDM:** Outbound calls are gated by `ABDM_ENABLED=false` until approved; outages never bypass consent or mark exchanges `COMPLETED`.
- **Circuit Breaker:** `withCircuitBreaker(provider, fn)` trips `OPEN` (`503 PROVIDER_CIRCUIT_OPEN`) after consecutive failures for a 30s cooldown window.
