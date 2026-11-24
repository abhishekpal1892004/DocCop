export const FHIR_VERSION = '4.0.1';
export const ABDM_IG_VERSION = 'ndhm.in#6.5.0';
export const NRCES_PROFILE_BASE = 'https://nrces.in/ndhm/fhir/r4/StructureDefinition';

export const ABDM_PROFILE_URLS = Object.freeze({
  DocumentBundle: `${NRCES_PROFILE_BASE}/DocumentBundle`,
  Patient: `${NRCES_PROFILE_BASE}/Patient`,
  Practitioner: `${NRCES_PROFILE_BASE}/Practitioner`,
  Organization: `${NRCES_PROFILE_BASE}/Organization`,
  Encounter: `${NRCES_PROFILE_BASE}/Encounter`,
  Composition: `${NRCES_PROFILE_BASE}/Composition`,
  PrescriptionRecord: `${NRCES_PROFILE_BASE}/PrescriptionRecord`,
  OPConsultRecord: `${NRCES_PROFILE_BASE}/OPConsultRecord`,
  DiagnosticReportRecord: `${NRCES_PROFILE_BASE}/DiagnosticReportRecord`,
  HealthDocumentRecord: `${NRCES_PROFILE_BASE}/HealthDocumentRecord`,
  MedicationRequest: `${NRCES_PROFILE_BASE}/MedicationRequest`,
  DiagnosticReport: `${NRCES_PROFILE_BASE}/DiagnosticReport`,
  DocumentReference: `${NRCES_PROFILE_BASE}/DocumentReference`,
});

export const TERMINOLOGY_SYSTEMS = Object.freeze({
  SNOMED_CT: 'http://snomed.info/sct',
  LOINC: 'http://loinc.org',
  ICD10: 'http://hl7.org/fhir/sid/icd-10',
  ABDM_CARE_CONTEXT: 'https://healthid.ndhm.gov.in',
  HPR: 'https://hpr.ndhm.gov.in',
  HFR: 'https://facility.ndhm.gov.in',
  NMC: 'https://nmc.org.in',
});
