# MediBook Production Environment Configuration

Reference [.env.production.example](.env.production.example). Never commit `.env` or embed secrets in Docker images or CI logs.

| Variable | Purpose | Notes |
|---|---|---|
| `NODE_ENV` | `production` | Enables production error redaction and strict key checks |
| `PORT` | `5000` | HTTP listen port |
| `TRUST_PROXY` | `1` | Required behind reverse proxy / TLS terminator |
| `MONGODB_URI` | `mongodb+srv://...` | Separate production Atlas cluster with TLS |
| `CLIENT_ORIGINS` | `https://...` | Strict comma-separated frontend origins (no `*`) |
| `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET` | Clerk Auth & Webhooks | Use `pk_live_...` / `sk_live_...`; enforce Admin MFA in Clerk |
| `CALENDLY_CLIENT_ID`, `CALENDLY_CLIENT_SECRET`, `CALENDLY_REDIRECT_URI`, `CALENDLY_WEBHOOK_SIGNING_KEY`, `CALENDLY_TOKEN_ENCRYPTION_KEY` | Calendly OAuth 2.1 + PKCE & Webhooks | 64-hex-char 32-byte encryption key |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID`, `TWILIO_WHATSAPP_FROM`, `TWILIO_CONTENT_SID_*`, `TWILIO_STATUS_CALLBACK_URL` | Twilio SMS & WhatsApp | Approved WhatsApp sender & Content Templates + India DLT IDs |
| `NOTIFICATION_SCHEDULER_ENABLED` | `false` on API, `true` on worker | Prevents duplicate schedulers across API replicas |
| `MEDICAL_DOC_ENCRYPTION_ACTIVE_VERSION`, `MEDICAL_DOC_ENCRYPTION_KEY_V1` | GridFS AES-256-GCM encryption | Supports key rotation (`V1`, `V2`, ...) |
| `CLAMAV_SCAN_ENABLED` | `true` (when ClamAV wired) | Defaults `false` (`UNSCANNED`) |
