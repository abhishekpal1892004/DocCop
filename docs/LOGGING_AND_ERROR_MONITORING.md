# MediBook Logging & Error Monitoring

## 1. Structured Logging (`src/utils/logger.js`)
- **Production & Staging:** Emits single-line JSON logs (`timestamp`, `level`, `service`, `env`, `message`, `correlationId`, `method`, `route`, `statusCode`, `durationMs`).
- **Development:** Emits human-readable timestamped console lines.
- **Test (`NODE_ENV=test`):** Suppressed unless `LOG_LEVEL=debug`.

## 2. Centralized Sensitive Data Redaction
`redactSensitive()` recursively replaces values for keys matching `password`, `secret`, `token`, `authorization`, `cookie`, `apiKey`, `abha`, `aadhaar`, `diagnosis`, `medicines`, `clinicalNotes`, `medicalRecord`, `prescription`, `symptoms`, `otp`, and `privateKey` with `[REDACTED]`, and strips `Bearer ...` headers.

## 3. Optional Error Tracking Adapter (`src/utils/errorTracker.js`)
- Disabled by default (`ERROR_TRACKING_ENABLED=false`).
- When enabled with `ERROR_TRACKING_DSN`, sends only sanitized metadata (`name`, `message`, `code`, `correlationId`, `method`, `route`, `statusCode`, `env`, `version`, `timestamp`) with a 3-second timeout. Never sends PHI, medical records, or raw request bodies.
- Global Express `errorHandler` never returns stack traces in production (`env.isProduction`).
