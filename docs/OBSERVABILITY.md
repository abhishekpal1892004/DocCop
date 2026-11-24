# MediBook Observability & Health Endpoints

## 1. Health & Metrics Endpoints
- `GET /api/v1/health/live` (Public): Process liveness, uptime, version, and `APP_ENV`.
- `GET /api/v1/health/ready` (Public): Verifies MongoDB connection readiness (`503 SERVICE_UNAVAILABLE` if down) without exposing connection strings or credentials.
- `GET /api/v1/health/metrics` (Protected): Requires `x-metrics-token` matching `METRICS_AUTH_TOKEN` (or authenticated `ADMIN` user). Returns HTTP counts, error rates, p50/p95/p99 request latencies, top routes, DB query latency, process memory/CPU, worker heartbeat, and bounded integration health (`HEALTHY`, `DEGRADED`, `UNAVAILABLE`, `NOT_CONFIGURED`).

## 2. In-Process Instrumentation (`src/utils/metrics.js`)
- `metricsMiddleware` tracks every HTTP request duration via `process.hrtime.bigint()`.
- `metrics.recordIntegrationCall(provider, ok)` tracks `clerk`, `calendly`, `twilio`, `razorpay`, `agora`, and `abdm` health without issuing expensive external probes on `/health/ready`.
