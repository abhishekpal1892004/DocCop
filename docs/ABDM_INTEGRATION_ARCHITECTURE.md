# MediBook ABDM Integration Architecture

## 1. Overview
MediBook integrates with India's Ayushman Bharat Digital Mission (ABDM) using a modular adapter layer (`src/integrations/abdm/`) while keeping Clerk authentication, MongoDB RBAC, GridFS document storage, and Phase 4 doctor/clinic verification independent.

## 2. Ecosystem Roles
- **ABHA (M1 – Optional Identity):** Voluntary patient linking; never replaces Clerk login.
- **HPR & HFR:** Registry lookup and association (`RegistryLink`) kept separate from statutory NMC/clinic verification.
- **HIP (M2 – Provider):** Converts eligible MediBook records to NRCeS FHIR R4 `ndhm.in#6.5.0` bundles and tracks `FhirExport` + `AbdmExchange`.
- **HIU (M3 – Consumer):** Requests external records strictly under `GRANTED` non-expired `AbdmConsent` and stores validated imports in `FhirImport` (`isExternal: true`).

## 3. Data Flow
```text
Patient/Doctor -> MediBook API -> abdm.client.js (gated by ABDM_ENABLED) -> ABDM v3 Gateway (/api/hiecm/gateway/v3/sessions)
ABDM Callback  -> POST /api/v1/webhooks/abdm (HMAC + Replay + Dedup) -> AbdmConsent / AbdmExchange / FhirImport
```
