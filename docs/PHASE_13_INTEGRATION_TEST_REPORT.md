# MediBook Phase 13 – Third-Party Integration Test Report

> Per QA rules, mocked tests verify our adapters, signature checks, and state machines, **not** live third-party network connectivity.

| Integration | Test Environment | Live Credentials | Automated Mock Tests | Live Sandbox Status |
|---|---|---|---|---|
| **Clerk** | Ephemeral RSA-2048 JWT + Svix HMAC | `NOT CONFIGURED` | **PASS** | `REQUIRES MANUAL APPROVAL` |
| **Calendly** | Mocked `calendlyClient` + HMAC webhook | `NOT CONFIGURED` | **PASS** | `REQUIRES MANUAL APPROVAL` |
| **Twilio** | Mocked `twilioClient` + signature check | `NOT CONFIGURED` | **PASS** | `REQUIRES MANUAL APPROVAL` |
| **Razorpay** | Mocked `razorpayClient` + HMAC-SHA256 | `NOT CONFIGURED` | **PASS** | `REQUIRES MANUAL APPROVAL` |
| **Agora** | Mocked token builder (`AGORA_ENABLED`) | `NOT CONFIGURED` | **PASS** | `REQUIRES MANUAL APPROVAL` |
| **ABDM / FHIR** | Mocked `abdmClient` + `ABDM_ENABLED=false` | `NOT CONFIGURED` | **PASS** | `REQUIRES MANUAL APPROVAL` |
