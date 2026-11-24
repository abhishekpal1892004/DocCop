# MediBook Phase 12 – Load Test Report

**Script:** `scripts/load-test.js`  
**Environment:** Local Node.js v26.3.0 on Windows (`127.0.0.1` ephemeral listener, `NODE_ENV=test`, in-memory fake user repository; zero external SMS/payments/ABDM calls).  
**Concurrency & Volume:** 150 requests per endpoint at concurrency 15 (450 total requests).

## Measured Results

| Endpoint | Requests | Concurrency | Avg (ms) | p50 (ms) | p95 (ms) | p99 (ms) | Throughput (req/s) | Errors |
|---|---|---|---|---|---|---|---|---|
| `GET /api/v1/health/live` | 150 | 15 | 49.18 | 32.05 | 168.07 | 186.67 | 291.9 | 0 |
| `GET /api/v1/users/me` | 150 | 15 | 33.39 | 34.03 | 37.26 | 38.97 | 438.7 | 0 |
| `GET /api/v1/admin/system-health` | 150 | 15 | 24.68 | 23.97 | 33.76 | 34.84 | 595.6 | 0 |

## Observations & Limitations
- All 450 synthetic requests completed with **0 errors**.
- Because these measurements ran against an in-memory fake repository on localhost, staging load tests against a live MongoDB Atlas cluster are still required before production cutover to measure real network + DB index latencies.
