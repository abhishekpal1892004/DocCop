# ABDM API & Sandbox Configuration

- `ABDM_ENABLED=false` (blocks all live outbound ABDM calls with `503 ABDM_EXTERNAL_DISABLED` until NHA credentials are provisioned)
- `ABDM_ENVIRONMENT=SANDBOX` (`SANDBOX` | `PRODUCTION`)
- `ABDM_BASE_URL=https://dev.abdm.gov.in` (ABDM v3 Gateway)
- `ABDM_ABHA_BASE_URL=https://abhasbx.abdm.gov.in` (ABHA v3 API)
- `ABDM_CM_ID=sbx`
- `ABDM_CLIENT_ID`, `ABDM_CLIENT_SECRET`, `ABDM_FACILITY_ID`, `ABDM_INTEGRATION_ROLE`, `ABDM_CALLBACK_BASE_URL`, `ABDM_ENCRYPTION_KEY`, `ABDM_WEBHOOK_SECRET`
