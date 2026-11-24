# MediBook Phase 13 – Regression Test Report

- **Command:** `node --test`
- **Total Suites:** 35
- **Total Tests Executed:** 114
- **Coverage:** Phases 1–13 backend modules (Auth, Users, Patients, Doctor Onboarding/NMC/Approval, Clinics, Organizations, Staff, Calendly Appointments, Twilio Notifications & Worker, Medical Records, Prescriptions, Consultations, Payments, Video, Reviews, Queue, Waitlist, Follow-ups, Support, ABDM/ABHA/HPR/HFR/HIP/HIU/Consent/Webhooks, FHIR R4, Observability, Security/IDOR).
- **Bug Fixed During Regression:** Eliminated timestamp millisecond collision (`403` in `.403Z`) in `tests/nmc.test.js` assertion (`!includes('HTTP 403') && !includes('internal token info')`).
- **Frontend / PWA Regression:** `NOT TESTED` (backend-only repository).
