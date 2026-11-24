# MediBook Production Deployment Guide

## 1. Process Architecture (API vs Worker)
- **API Process (`npm start` -> `node src/server.js`):** Set `RUN_EMBEDDED_WORKER=false` (the default) so scaled API replicas do not start duplicate `node-cron` schedulers.
- **Worker Process (`npm run worker` -> `node src/workers/notification.worker.js`):** Runs `startNotificationScheduler()` using MongoDB atomic `findOneAndUpdate` job claiming and lease expiration recovery (no Redis/BullMQ).

## 2. Docker Build & Run
```bash
docker build -t medibook-api:latest .
# API container
docker run -d --env-file .env.production -p 5000:5000 medibook-api:latest
# Dedicated Worker container
docker run -d --env-file .env.production medibook-api:latest node src/workers/notification.worker.js
```

## 3. Required GitHub Actions Secrets
- `STAGING_HEALTH_URL` (staging base URL for post-deploy readiness smoke test)
- `PROD_HEALTH_URL` (production base URL for post-deploy liveness/readiness checks)
- Environment protection rule on `production` requiring manual reviewer approval.

## 4. Rollback Procedure
1. Re-deploy the previous known-good container tag (`medibook-api:<previous-sha>`).
2. Verify `GET /api/v1/health/live` and `GET /api/v1/health/ready` return HTTP `200`.
3. Inspect `GET /api/v1/admin/system-health` for any failed jobs or webhooks requiring safe retry.
