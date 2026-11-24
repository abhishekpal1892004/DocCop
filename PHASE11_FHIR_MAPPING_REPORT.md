# MediBook Phase 11 – FHIR R4 Mapping Report

**Standard:** HL7 FHIR R4 (`4.0.1`)  
**Implementation Guide:** NRCeS ABDM FHIR Implementation Guide (`ndhm.in#6.5.0`)  
**Profile Canonical Base:** `https://nrces.in/ndhm/fhir/r4/StructureDefinition/`

## 1. MediBook-to-FHIR R4 Resource Mapping

| MediBook Source | FHIR R4 Resource | NRCeS Profile | Notes |
|---|---|---|---|
| `User` + `PatientProfile` + optional `AbhaLink` | `Patient` | `StructureDefinition/Patient` | Uses real stored fields; includes masked ABHA reference only if verified |
| `Doctor` + optional `RegistryLink(HPR)` | `Practitioner` | `StructureDefinition/Practitioner` | Includes NMC registration (`https://nmc.org.in`) and optional HPR ID (`https://hpr.ndhm.gov.in`) |
| `Clinic` + optional `RegistryLink(HFR)` | `Organization` | `StructureDefinition/Organization` | Includes clinic name, address, and optional HFR ID (`https://facility.ndhm.gov.in`) |
| `Consultation` | `Encounter` | `StructureDefinition/Encounter` | Ambulatory (`AMB`) encounter linked to patient, practitioner, and clinic |
| `Prescription` | `Composition` + `MedicationRequest[]` | `PrescriptionRecord`, `MedicationRequest` | Represents stored medicine text; flags `TEXT_ONLY_MAPPING_REQUIRED` instead of fabricating SNOMED/RxNorm codes |
| `MedicalRecord` (`LAB_REPORT` / `DIAGNOSTIC_REPORT`) | `Composition` + `DiagnosticReport` | `DiagnosticReportRecord`, `DiagnosticReport` | Maps title, effective date, and conclusion |
| `MedicalRecord` (other categories) | `Composition` + `DocumentReference` | `HealthDocumentRecord`, `DocumentReference` | Maps content type, file title, and byte size |
| Combined record exchange | `Bundle` (`type: document`) | `DocumentBundle` | `entry[0]` is always `Composition` with resolved `urn:uuid:` references |

## 2. Validation Rules (`src/modules/interoperability/fhir/fhir.validator.js`)
- Validates `resourceType` and `meta.profile` against supported NRCeS ABDM IG profiles.
- Enforces required fields per resource type (`Patient.name`, `Practitioner.name`, `Organization.name`, `Composition.status/type/subject/date/author/title`, `MedicationRequest.medicationCodeableConcept`, `DiagnosticReport.code`, `DocumentReference.content`).
- Rejects `coding` entries missing either `system` or `code`.
- Verifies all `urn:uuid:...` references resolve to an entry `fullUrl` inside `Bundle.entry`.
