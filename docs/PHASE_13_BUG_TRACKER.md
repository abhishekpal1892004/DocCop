# MediBook Phase 13 – Bug Tracker

| ID | Severity | Area | Description | Root Cause | Fix & Verification | Status |
|---|---|---|---|---|---|---|
| BUG-13-01 | Low | `tests/nmc.test.js` | Intermittent failure when `attemptedAt` timestamp milliseconds contained `403` | `assert.ok(!JSON.stringify(res.body).includes('403'))` matched `.403Z` | Updated assertion to check `!includes('HTTP 403')` and `!includes('internal token info')`; verified `11/11` pass | **FIXED** |

- **Critical / High Bugs Found:** 0 in backend application code during Phase 13 execution.
- **Earlier Bugs Fixed During Implementation Phases 10–12 (for traceability):** `ApiResponse` 3-arg vs 2-arg call in `support.controller.js`, `appointmentRepository.list` signature in `consent.service.js`, `clinic.createdByUserId` check in `clinic.service.js`, `Notification` model path in `systemHealth.controller.js` — all resolved and covered by regression tests.
