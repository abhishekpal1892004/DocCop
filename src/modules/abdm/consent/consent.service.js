import crypto from 'node:crypto';
import { abdmClient } from '../../../integrations/abdm/abdm.client.js';
import { getAbdmRuntimeConfig } from '../../../integrations/abdm/abdm.config.js';
import { abdmCrypto } from '../../../integrations/abdm/abdm.crypto.js';
import { abdmMapper } from '../../../integrations/abdm/abdm.mapper.js';
import { ApiError } from '../../../utils/ApiError.js';
import { appointmentRepository } from '../../appointments/appointment.repository.js';
import { AUDIT_ACTIONS, AUDIT_TARGET_TYPES } from '../../auditLogs/auditLog.constants.js';
import { recordAuditEvent } from '../../auditLogs/auditLog.service.js';
import { doctorRepository } from '../../doctors/doctor.repository.js';
import { ROLES } from '../../users/user.constants.js';
import { abdmRepository } from '../abdm.repository.js';
import { ABDM_CONSENT_STATUS } from '../models/abdmConsent.model.js';

export const toPublicConsent = (c) => ({
  id: String(c._id),
  patientId: String(c.patientId),
  consentManagerReference: c.consentManagerReference ?? null,
  consentRequestId: c.consentRequestId,
  purpose: c.purpose,
  requesterId: c.requesterId,
  requesterRole: c.requesterRole,
  recordTypes: c.recordTypes,
  dateRange: c.dateRange,
  status: c.status,
  grantedAt: c.grantedAt ?? null,
  revokedAt: c.revokedAt ?? null,
  expiresAt: c.expiresAt,
  createdAt: c.createdAt,
});

export const requestAbdmConsent = async (user, input, requestId = null) => {
  let targetPatientId = user._id;
  if (user.role === ROLES.DOCTOR) {
    if (!input.patientId) {
      throw new ApiError(400, 'patientId is required when a doctor requests consent', 'PATIENT_ID_REQUIRED');
    }
    const doctor = await doctorRepository.findByUserId(user._id);
    if (!doctor) throw new ApiError(403, 'Doctor profile not found', 'FORBIDDEN');
    const { items } = await appointmentRepository.list(
      { patientId: input.patientId, doctorId: doctor._id },
      { limit: 1 }
    );
    if (!items || items.length === 0) {
      throw new ApiError(403, 'Doctors can only request consent for patients they have treated', 'FORBIDDEN');
    }
    targetPatientId = input.patientId;
  } else if (user.role !== ROLES.PATIENT) {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }

  const abhaLink = await abdmRepository.findAbhaByPatientId(targetPatientId);
  if (!abhaLink || abhaLink.verificationStatus !== 'VERIFIED') {
    throw new ApiError(400, 'Patient must have a verified ABHA link before requesting consent', 'ABHA_NOT_LINKED');
  }

  const cfg = getAbdmRuntimeConfig();
  const abhaAddress = abhaLink.abhaAddressEncrypted
    ? abdmCrypto.decrypt(abhaLink.abhaAddressEncrypted)
    : abdmCrypto.decrypt(abhaLink.abhaNumberEncrypted);

  const consentRequestId = crypto.randomUUID();
  await abdmClient.hiuInitConsentRequest(
    abdmMapper.toConsentInitPayload({
      consentRequestId,
      abhaAddress,
      hiuId: cfg.facilityId || 'medibook-hiu',
      purpose: input.purpose,
      hiTypes: input.recordTypes,
      dateRange: input.dateRange,
      expiryAt: input.expiresAt,
      requesterName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'MediBook Requester',
    })
  );

  const saved = await abdmRepository.createConsent({
    patientId: targetPatientId,
    consentRequestId,
    purpose: input.purpose,
    requesterId: String(user._id),
    requesterRole: user.role,
    recordTypes: input.recordTypes,
    dateRange: input.dateRange,
    status: ABDM_CONSENT_STATUS.REQUESTED,
    expiresAt: input.expiresAt,
  });

  await recordAuditEvent({
    actorUserId: user._id,
    actorRole: user.role,
    action: AUDIT_ACTIONS.ABDM_HIU_CONSENT_REQUESTED,
    targetType: AUDIT_TARGET_TYPES.ABDM_CONSENT,
    targetId: saved._id,
    outcome: 'SUCCESS',
    requestId,
  });

  return toPublicConsent(saved);
};

export const getConsentById = async (user, id) => {
  const consent = await abdmRepository.findConsentById(id);
  if (!consent) throw new ApiError(404, 'Consent record not found', 'CONSENT_NOT_FOUND');
  if (
    user.role !== ROLES.ADMIN &&
    String(consent.patientId) !== String(user._id) &&
    String(consent.requesterId) !== String(user._id)
  ) {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }
  return toPublicConsent(consent);
};

export const listMyConsents = async (user) => {
  const items = await abdmRepository.listConsentsByPatient(user._id);
  return items.map(toPublicConsent);
};

export const revokeAbdmConsent = async (user, id, requestId = null) => {
  const consent = await abdmRepository.findConsentById(id);
  if (!consent) throw new ApiError(404, 'Consent record not found', 'CONSENT_NOT_FOUND');
  if (String(consent.patientId) !== String(user._id)) {
    throw new ApiError(403, 'Only the patient can revoke consent', 'FORBIDDEN');
  }
  if (consent.status === ABDM_CONSENT_STATUS.REVOKED) {
    return toPublicConsent(consent);
  }

  await abdmClient.hiuRevokeConsent({
    consentId: consent.consentManagerReference || consent.consentRequestId,
  });

  const updated = await abdmRepository.updateConsentById(consent._id, {
    status: ABDM_CONSENT_STATUS.REVOKED,
    revokedAt: new Date(),
  });

  await recordAuditEvent({
    actorUserId: user._id,
    actorRole: user.role,
    action: AUDIT_ACTIONS.ABDM_HIU_CONSENT_REVOKED,
    targetType: AUDIT_TARGET_TYPES.ABDM_CONSENT,
    targetId: consent._id,
    outcome: 'SUCCESS',
    requestId,
  });

  return toPublicConsent(updated);
};
