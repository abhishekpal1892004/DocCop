# FHIR R4 Implementation (NRCeS ABDM IG v6.5.0)

- **Base Standard:** HL7 FHIR R4 (`4.0.1`), Package `ndhm.in#6.5.0`.
- **Supported Resources:** `Patient`, `Practitioner`, `Organization`, `Encounter`, `Composition`, `MedicationRequest`, `DiagnosticReport`, `DocumentReference`, and `Bundle` (`type: document`).
- **Endpoints:** `POST /api/v1/interoperability/fhir/convert`, `POST /api/v1/interoperability/fhir/validate`, `GET /api/v1/interoperability/fhir/records/:id`.
- **Validation:** Enforces `meta.profile`, required fields, coding `system` + `code` pairs, and internal `urn:uuid:` reference resolution. Never fabricates SNOMED/LOINC codes when unavailable.
