# MediBook Deployment Guide

## 1. Backend API Service
- **Runtime**: Node.js >= 20 (`node:22-alpine` in [Dockerfile](Dockerfile))
- **Start command**: `npm start` (`node src/server.js`)
- **Health endpoints**: `GET /api/v1/health/live`, `GET /api/v1/health/ready`
- **Reverse Proxy**: Set `TRUST_PROXY=1` when behind a load balancer/reverse proxy so rate limiting and Twilio webhook URL reconstruction see the external HTTPS origin.
- **API Replicas**: Set `NOTIFICATION_SCHEDULER_ENABLED=false` on API replicas so only the dedicated worker processes notifications.

## 2. Dedicated Notification Worker
- **Start command**: `npm run worker` (`node src/workers/notification.worker.js`)
- **Scaling**: Uses atomic MongoDB `findOneAndUpdate` leases (`lockUntil`) and `providerMessageSid` checks so multiple workers cannot double-claim jobs.

## 3. MongoDB Atlas Setup
- Provision an M10+ cluster in the target jurisdiction (e.g., `ap-south-1` Mumbai for Indian healthcare data).
- Enable TLS, SCRAM-SHA-256 authentication, least-privilege database user (`readWrite` on the MediBook database only), and IP allowlisting.
- Keep development and production clusters strictly separate.
