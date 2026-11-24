import { ABDM_PROFILE_URLS, TERMINOLOGY_SYSTEMS } from './fhir.constants.js';

const mapGender = (gender) => {
  if (!gender) return 'unknown';
  const g = String(gender).toLowerCase();
  if (g === 'male' || g === 'female' || g === 'other') return g;
  return 'unknown';
};

export const mapPatientToFhir = ({ id, user, patientProfile, abhaMasked = null }) => {
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || user?.email || 'MediBook Patient';
  const identifiers = [
    {
      system: 'https://medibook.local/patient-id',
      value: String(user?._id || id),
    },
  ];
  if (abhaMasked) {
    identifiers.push({
      system: TERMINOLOGY_SYSTEMS.ABDM_CARE_CONTEXT,
      value: abhaMasked,
    });
  }

  const resource = {
    resourceType: 'Patient',
    id: String(id),
    meta: { profile: [ABDM_PROFILE_URLS.Patient] },
    identifier: identifiers,
    name: [{ text: fullName }],
    gender: mapGender(patientProfile?.gender),
  };

  if (patientProfile?.dateOfBirth) {
    resource.birthDate = new Date(patientProfile.dateOfBirth).toISOString().slice(0, 10);
  }
  if (patientProfile?.phoneNumber) {
    resource.telecom = [{ system: 'phone', value: patientProfile.phoneNumber }];
  }
  if (patientProfile?.address?.city || patientProfile?.address?.state) {
    resource.address = [
      {
        line: patientProfile.address.street ? [patientProfile.address.street] : undefined,
        city: patientProfile.address.city,
        state: patientProfile.address.state,
        postalCode: patientProfile.address.pincode,
        country: patientProfile.address.country || 'IN',
      },
    ];
  }
  return resource;
};

export const mapDoctorToFhir = ({ id, doctor, hprLink = null }) => {
  const identifiers = [];
  if (doctor?.medicalRegistration?.registrationNumber) {
    identifiers.push({
      system: TERMINOLOGY_SYSTEMS.NMC,
      value: doctor.medicalRegistration.registrationNumber,
    });
  }
  if (hprLink?.registryId) {
    identifiers.push({
      system: TERMINOLOGY_SYSTEMS.HPR,
      value: hprLink.registryId,
    });
  }

  return {
    resourceType: 'Practitioner',
    id: String(id),
    meta: { profile: [ABDM_PROFILE_URLS.Practitioner] },
    identifier: identifiers.length ? identifiers : [{ system: 'https://medibook.local/doctor-id', value: String(doctor?._id || id) }],
    name: [{ text: doctor?.personalDetails?.fullName || 'MediBook Practitioner' }],
  };
};

export const mapClinicToFhir = ({ id, clinic, hfrLink = null }) => {
  const identifiers = [
    {
      system: 'https://medibook.local/clinic-id',
      value: String(clinic?._id || id),
    },
  ];
  if (hfrLink?.registryId) {
    identifiers.push({
      system: TERMINOLOGY_SYSTEMS.HFR,
      value: hfrLink.registryId,
    });
  }

  return {
    resourceType: 'Organization',
    id: String(id),
    meta: { profile: [ABDM_PROFILE_URLS.Organization] },
    identifier: identifiers,
    name: clinic?.clinicName || 'MediBook Clinic',
    address: clinic?.address
      ? [
          {
            line: clinic.address.street ? [clinic.address.street] : undefined,
            city: clinic.address.city,
            state: clinic.address.state,
            postalCode: clinic.address.pincode,
            country: clinic.address.country || 'IN',
          },
        ]
      : undefined,
  };
};

export const mapConsultationToFhirEncounter = ({ id, consultation, patientRef, practitionerRef, organizationRef }) => ({
  resourceType: 'Encounter',
  id: String(id),
  meta: { profile: [ABDM_PROFILE_URLS.Encounter] },
  status: consultation.status === 'COMPLETED' ? 'finished' : 'in-progress',
  class: {
    system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
    code: 'AMB',
    display: 'ambulatory',
  },
  subject: { reference: patientRef },
  participant: practitionerRef ? [{ individual: { reference: practitionerRef } }] : undefined,
  serviceProvider: organizationRef ? { reference: organizationRef } : undefined,
  period: {
    start: new Date(consultation.consultationDate || consultation.createdAt || Date.now()).toISOString(),
    end: consultation.completedAt ? new Date(consultation.completedAt).toISOString() : undefined,
  },
});

export const mapPrescriptionToFhirMedicationRequests = ({
  prescription,
  patientRef,
  practitionerRef,
  encounterRef,
}) => {
  const items = Array.isArray(prescription.medicines) ? prescription.medicines : [];
  return items.map((med, idx) => ({
    resourceType: 'MedicationRequest',
    id: `${prescription._id}-med-${idx + 1}`,
    meta: {
      profile: [ABDM_PROFILE_URLS.MedicationRequest],
      tag: [
        {
          system: 'https://medibook.local/terminology-status',
          code: 'TEXT_ONLY_MAPPING_REQUIRED',
          display: 'No fabricated clinical code; terminology mapping pending',
        },
      ],
    },
    status: prescription.status === 'VOIDED' ? 'cancelled' : prescription.status === 'ISSUED' ? 'active' : 'draft',
    intent: 'order',
    medicationCodeableConcept: {
      text: [med.medicineName, med.strength, med.dosageForm].filter(Boolean).join(' '),
    },
    subject: { reference: patientRef },
    requester: practitionerRef ? { reference: practitionerRef } : undefined,
    encounter: encounterRef ? { reference: encounterRef } : undefined,
    authoredOn: new Date(prescription.issuedAt || prescription.createdAt || Date.now()).toISOString(),
    dosageInstruction: [
      {
        text: [med.dose, med.frequency, med.duration, med.instructions].filter(Boolean).join(' - '),
        route: med.route ? { text: med.route } : undefined,
      },
    ],
  }));
};

export const mapMedicalRecordToFhir = ({ id, record, patientRef }) => {
  if (record.category === 'DIAGNOSTIC_REPORT' || record.category === 'LAB_REPORT') {
    return {
      resourceType: 'DiagnosticReport',
      id: String(id),
      meta: { profile: [ABDM_PROFILE_URLS.DiagnosticReport] },
      status: 'final',
      code: {
        text: record.title,
      },
      subject: { reference: patientRef },
      effectiveDateTime: new Date(record.uploadedAt || record.createdAt || Date.now()).toISOString(),
      conclusion: record.description || undefined,
    };
  }

  return {
    resourceType: 'DocumentReference',
    id: String(id),
    meta: { profile: [ABDM_PROFILE_URLS.DocumentReference] },
    status: 'current',
    type: {
      text: record.category || record.title,
    },
    subject: { reference: patientRef },
    date: new Date(record.uploadedAt || record.createdAt || Date.now()).toISOString(),
    description: record.title,
    content: [
      {
        attachment: {
          contentType: record.file?.mimeType || 'application/pdf',
          title: record.file?.originalName || record.title,
          size: record.file?.fileSize,
        },
      },
    ],
  };
};
