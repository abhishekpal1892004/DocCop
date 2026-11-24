import crypto from 'node:crypto';
import { abdmClient } from '../../../integrations/abdm/abdm.client.js';
import { getAbdmRuntimeConfig } from '../../../integrations/abdm/abdm.config.js';
import { abdmCrypto } from '../../../integrations/abdm/abdm.crypto.js';
import { abdmMapper } from '../../../integrations/abdm/abdm.mapper.js';
import { ApiError } from '../../../utils/ApiError.js';
import { AUDIT_ACTIONS, AUDIT_TARGET_TYPES } from '../../auditLogs/auditLog.constants.js';
import { recordAuditEvent } from '../../auditLogs/auditLog.service.js';
import { clinicRepository } from '../../clinics/clinic.repository.js';
import { consultationRepository } from '../../consultations/consultation.repository.js';
import { doctorRepository } from '../../doctors/doctor.repository.js';
import { buildFhirBundle } from '../../interoperability/fhir/fhir.bundle.service.js';
import { ABDM_IG_VERSION } from '../../interoperability/fhir/fhir.constants.js';
import { medicalRecordRepository } from '../../medicalRecords/medicalRecord.repository.js';
import { patientRepository } from '../../patients/patient.repository.js';
import { prescriptionRepository } from '../../prescriptions/prescription.repository.js';
import { ROLES } from '../../users/user.constants.js';
import { userRepository } from '../../users/user.repository.js';
import { abdmRepository } from '../abdm.repository.js';
import { ABDM_EXCHANGE_STATUS } from '../models/abdmExchange.model.js';

export const toPublicExchange = (ex) => ({
  id: String(ex._id),
  patientId: String(ex.patientId),
  healthRecordId: ex.healthRecordId ? String(ex.healthRecordId) : null,
  recordSourceType: ex.recordSourceType,
  direction: ex.direction,
  role: ex.role,
  transactionId: ex.transactionId,
  requestId: ex.requestId,
  consentReference: ex.consentReference ?? null,
  recordType: ex.recordType,
  fhirProfileVersion: ex.fhirProfileVersion,
  facilityId: ex.facilityId ?? null,
  status: ex.status,
  retrievedBundleSummary: ex.retrievedBundleSummary ?? null,
  createdAt: ex.createdAt,
  updatedAt: ex.updatedAt,
});

export const linkHealthRecordAsHip = async (user, { recordSourceType, healthRecordId }, requestId = null) => {
  let record = null;
  if (recordSourceType === 'PRESCRIPTION') record = await prescriptionRepository.findById(healthRecordId);
  else if (recordSourceType === 'CONSULTATION') record = await consultationRepository.findById(healthRecordId);
  else record = await medicalRecordRepository.findById(healthRecordId);

  if (!record) throw new ApiError(404, 'Health record not found', 'RECORD_NOT_FOUND');

  if (user.role === ROLES.PATIENT && String(record.patientId) !== String(user._id)) {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  } else if (user.role === ROLES.DOCTOR) {
    const doc = await doctorRepository.findByUserId(user._id);
    if (!doc || (record.doctorId && String(record.doctorId) !== String(doc._id))) {
      throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
    }
  } else if (user.role !== ROLES.PATIENT && user.role !== ROLES.DOCTOR && user.role !== ROLES.ADMIN) {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }

  const abhaLink = await abdmRepository.findAbhaByPatientId(record.patientId);
  if (!abhaLink || abhaLink.verificationStatus !== 'VERIFIED') {
    throw new ApiError(400, 'Patient must have a verified ABHA link for HIP sharing', 'ABHA_NOT_LINKED');
  }

  const duplicate = await abdmRepository.findExchangeByHealthRecordAndRole(record._id, 'HIP');
  if (duplicate) {
    throw new ApiError(409, 'Health record is already linked in ABDM HIP', 'HIP_ALREADY_LINKED');
  }

  const [patientUser, patientProfile, doctor, clinic] = await Promise.all([
    userRepository.findById(record.patientId),
    patientRepository.findByUserId(record.patientId),
    record.doctorId ? doctorRepository.findById(record.doctorId) : null,
    record.clinicId ? clinicRepository.findById(record.clinicId) : null,
  ]);
  const [hprLink, hfrLink] = await Promise.all([
    doctor ? abdmRepository.findRegistryLink('HPR', doctor._id) : null,
    clinic ? abdmRepository.findRegistryLink('HFR', clinic._id) : null,
  ]);

  // Build and validate FHIR R4 bundle before sending to ABDM
  const { bundle } = buildFhirBundle({
    recordSourceType,
    record,
    user: patientUser,
    patientProfile,
    doctor,
    clinic,
    abhaLink,
    hprLink,
    hfrLink,
  });

  const cfg = getAbdmRuntimeConfig();
  const abhaAddress = abhaLink.abhaAddressEncrypted
    ? abdmCrypto.decrypt(abhaLink.abhaAddressEncrypted)
    : abhaLink.abhaNumberEncrypted
      ? abdmCrypto.decrypt(abhaLink.abhaNumberEncrypted)
      : null;

  const transactionId = crypto.randomUUID();
  const abdmRequestId = crypto.randomUUID();

  await abdmClient.hipLinkCareContext(
    abdmMapper.toHipCareContextLinkPayload({
      transactionId,
      abhaAddress,
      patientReference: String(record.patientId),
      careContexts: [{ referenceNumber: String(record._id), display: record.title || recordSourceType }],
    })
  );

  const exchange = await abdmRepository.createExchange({
    patientId: record.patientId,
    healthRecordId: record._id,
    recordSourceType,
    direction: 'OUTBOUND',
    role: 'HIP',
    transactionId,
    requestId: abdmRequestId,
    recordType: recordSourceType,
    fhirProfileVersion: ABDM_IG_VERSION,
    facilityId: hfrLink?.registryId || cfg.facilityId || null,
    status: ABDM_EXCHANGE_STATUS.INITIATED,
  });

  await abdmRepository.createFhirExport({
    patientId: record.patientId,
    recordSourceType,
    sourceRecordId: record._id,
    exchangeId: exchange._id,
    bundleId: bundle.id,
    fhirProfileVersion: ABDM_IG_VERSION,
    validationStatus: 'VALID',
    exportedBy: user._id,
  });

  await recordAuditEvent({
    actorUserId: user._id,
    actorRole: user.role,
    action: AUDIT_ACTIONS.ABDM_HIP_RECORD_LINKED,
    targetType: AUDIT_TARGET_TYPES.ABDM_EXCHANGE,
    targetId: exchange._id,
    outcome: 'SUCCESS',
    requestId,
    metadata: { recordSourceType, healthRecordId: String(record._id) },
  });

  return toPublicExchange(exchange);
};

export const notifyHipContext = async (user, { exchangeId }, requestId = null) => {
  const existing = await abdmRepository.findExchangeById(exchangeId);
  if (!existing || existing.role !== 'HIP') {
    throw new ApiError(404, 'HIP exchange record not found', 'EXCHANGE_NOT_FOUND');
  }
  if (user.role === ROLES.PATIENT && String(existing.patientId) !== String(user._id)) {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }

  await abdmClient.hipNotifyContext({
    transactionId: existing.transactionId,
    careContext: { referenceNumber: String(existing.healthRecordId) },
  });

  const updated = await abdmRepository.updateExchangeById(existing._id, {
    status: ABDM_EXCHANGE_STATUS.PENDING,
  });

  await recordAuditEvent({
    actorUserId: user._id,
    actorRole: user.role,
    action: AUDIT_ACTIONS.ABDM_HIP_RECORD_NOTIFIED,
    targetType: AUDIT_TARGET_TYPES.ABDM_EXCHANGE,
    targetId: existing._id,
    outcome: 'SUCCESS',
    requestId,
  });

  return toPublicExchange(updated);
};

export const getHipExchangeStatus = async (user, exchangeId) => {
  const existing = await abdmRepository.findExchangeById(exchangeId);
  if (!existing || existing.role !== 'HIP') {
    throw new ApiError(404, 'HIP exchange record not found', 'EXCHANGE_NOT_FOUND');
  }
  if (user.role !== ROLES.ADMIN && String(existing.patientId) !== String(user._id)) {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }
  return toPublicExchange(existing);
};
