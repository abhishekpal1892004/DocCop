import crypto from 'node:crypto';
import { ApiError } from '../../../utils/ApiError.js';
import { ABDM_PROFILE_URLS, TERMINOLOGY_SYSTEMS } from './fhir.constants.js';
import {
  mapClinicToFhir,
  mapConsultationToFhirEncounter,
  mapDoctorToFhir,
  mapMedicalRecordToFhir,
  mapPatientToFhir,
  mapPrescriptionToFhirMedicationRequests,
} from './fhir.mapper.js';
import { validateFhirBundle } from './fhir.validator.js';

export const buildFhirBundle = ({
  recordSourceType,
  record,
  user,
  patientProfile = null,
  doctor = null,
  clinic = null,
  abhaLink = null,
  hprLink = null,
  hfrLink = null,
}) => {
  const bundleId = crypto.randomUUID();
  const compositionId = crypto.randomUUID();
  const patientUuid = `urn:uuid:${crypto.randomUUID()}`;
  const practitionerUuid = doctor ? `urn:uuid:${crypto.randomUUID()}` : null;
  const organizationUuid = clinic ? `urn:uuid:${crypto.randomUUID()}` : null;

  const entries = [];
  const sectionEntries = [];

  const patientResource = mapPatientToFhir({
    id: patientUuid.replace('urn:uuid:', ''),
    user,
    patientProfile,
    abhaMasked: abhaLink?.verificationStatus === 'VERIFIED' ? abhaLink.abhaAddressMasked || abhaLink.abhaNumberMasked : null,
  });

  const practitionerResource = doctor
    ? mapDoctorToFhir({ id: practitionerUuid.replace('urn:uuid:', ''), doctor, hprLink })
    : null;

  const organizationResource = clinic
    ? mapClinicToFhir({ id: organizationUuid.replace('urn:uuid:', ''), clinic, hfrLink })
    : null;

  let compositionProfile = ABDM_PROFILE_URLS.HealthDocumentRecord;
  let compositionTitle = 'Health Document';
  let compositionType = {
    coding: [{ system: TERMINOLOGY_SYSTEMS.LOINC, code: '34133-9', display: 'Summary of episode note' }],
    text: 'Health Document',
  };

  if (recordSourceType === 'PRESCRIPTION') {
    compositionProfile = ABDM_PROFILE_URLS.PrescriptionRecord;
    compositionTitle = `Prescription ${record.prescriptionNumber || record._id}`;
    compositionType = {
      coding: [{ system: TERMINOLOGY_SYSTEMS.SNOMED_CT, code: '440545006', display: 'Prescription record' }],
      text: 'Prescription record',
    };
    const meds = mapPrescriptionToFhirMedicationRequests({
      prescription: record,
      patientRef: patientUuid,
      practitionerRef: practitionerUuid,
    });
    for (const med of meds) {
      const fullUrl = `urn:uuid:${crypto.randomUUID()}`;
      entries.push({ fullUrl, resource: med });
      sectionEntries.push({ reference: fullUrl });
    }
  } else if (recordSourceType === 'CONSULTATION') {
    compositionProfile = ABDM_PROFILE_URLS.OPConsultRecord;
    compositionTitle = 'OP Consultation Record';
    compositionType = {
      coding: [{ system: TERMINOLOGY_SYSTEMS.SNOMED_CT, code: '371530004', display: 'Clinical consultation report' }],
      text: 'OP Consultation',
    };
    const encUuid = `urn:uuid:${crypto.randomUUID()}`;
    const enc = mapConsultationToFhirEncounter({
      id: encUuid.replace('urn:uuid:', ''),
      consultation: record,
      patientRef: patientUuid,
      practitionerRef: practitionerUuid,
      organizationRef: organizationUuid,
    });
    entries.push({ fullUrl: encUuid, resource: enc });
    sectionEntries.push({ reference: encUuid });
  } else {
    const isDiag = record.category === 'DIAGNOSTIC_REPORT' || record.category === 'LAB_REPORT';
    compositionProfile = isDiag ? ABDM_PROFILE_URLS.DiagnosticReportRecord : ABDM_PROFILE_URLS.HealthDocumentRecord;
    compositionTitle = record.title || 'Medical Record';
    const recUuid = `urn:uuid:${crypto.randomUUID()}`;
    const mapped = mapMedicalRecordToFhir({
      id: recUuid.replace('urn:uuid:', ''),
      record,
      patientRef: patientUuid,
    });
    entries.push({ fullUrl: recUuid, resource: mapped });
    sectionEntries.push({ reference: recUuid });
  }

  const authorRefs = [];
  if (practitionerUuid) authorRefs.push({ reference: practitionerUuid });
  else if (organizationUuid) authorRefs.push({ reference: organizationUuid });
  else authorRefs.push({ reference: patientUuid });

  const composition = {
    resourceType: 'Composition',
    id: compositionId,
    meta: { profile: [compositionProfile] },
    status: 'final',
    type: compositionType,
    subject: { reference: patientUuid },
    date: new Date(record.issuedAt || record.completedAt || record.uploadedAt || record.createdAt || Date.now()).toISOString(),
    author: authorRefs,
    title: compositionTitle,
    custodian: organizationUuid ? { reference: organizationUuid } : undefined,
    section: [
      {
        title: compositionTitle,
        entry: sectionEntries,
      },
    ],
  };

  const bundle = {
    resourceType: 'Bundle',
    id: bundleId,
    meta: { profile: [ABDM_PROFILE_URLS.DocumentBundle] },
    identifier: {
      system: 'https://medibook.local/fhir-bundle',
      value: bundleId,
    },
    type: 'document',
    timestamp: new Date().toISOString(),
    entry: [
      { fullUrl: `urn:uuid:${compositionId}`, resource: composition },
      { fullUrl: patientUuid, resource: patientResource },
      ...(practitionerResource ? [{ fullUrl: practitionerUuid, resource: practitionerResource }] : []),
      ...(organizationResource ? [{ fullUrl: organizationUuid, resource: organizationResource }] : []),
      ...entries,
    ],
  };

  const validation = validateFhirBundle(bundle);
  if (!validation.valid) {
    throw new ApiError(422, 'Generated FHIR bundle failed validation', 'FHIR_VALIDATION_FAILED', validation.errors);
  }

  return { bundle, validation };
};
