# MediBook Phase 13 – Performance & Load Test Report

- **Tool:** `scripts/load-test.js` (Node.js native `fetch` against `http.createServer(app)` on `127.0.0.1` with synthetic user & fake repository).
- **Results (150 requests / endpoint @ concurrency 15, 450 total requests):**
  - `GET /api/v1/health/live`: avg `114.64 ms`, p50 `79.57 ms`, p95 `335.48 ms`, p99 `362.15 ms`, `124.7 req/s`, `0` errors.
  - `GET /api/v1/users/me`: avg `61.82 ms`, p50 `58.9 ms`, p95 `83.14 ms`, p99 `85.44 ms`, `235.3 req/s`, `0` errors.
  - `GET /api/v1/admin/system-health`: avg `55.66 ms`, p50 `52.48 ms`, p95 `91.62 ms`, p99 `93.38 ms`, `263.5 req/s`, `0` errors.
- **Staging Live MongoDB Atlas Load Test:** `NOT TESTED` (requires live staging MongoDB Atlas cluster).
