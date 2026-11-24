import { abdmClient } from '../../../integrations/abdm/abdm.client.js';
import { ApiError } from '../../../utils/ApiError.js';
import { AUDIT_ACTIONS, AUDIT_TARGET_TYPES } from '../../auditLogs/auditLog.constants.js';
import { recordAuditEvent } from '../../auditLogs/auditLog.service.js';
import { requireApprovedDoctorForUser } from '../../calendly/calendly.service.js';
import { abdmRepository } from '../abdm.repository.js';

export const toPublicHprLink = (link) =>
  link
    ? {
        id: String(link._id),
        hprId: link.registryId,
        source: link.source,
        lookupTimestamp: link.lookupTimestamp,
        registryStatus: link.registryStatus,
        verificationResult: link.verificationResult,
        adminReviewStatus: link.adminReviewStatus,
      }
    : null;

export const searchHprProfile = async (user, { hprId }) => {
  await requireApprovedDoctorForUser(user);
  const result = await abdmClient.lookupHprProfile(hprId);
  return { hprId, registryData: result ?? null };
};

export const linkHprProfile = async (user, { hprId }, requestId = null) => {
  const doctor = await requireApprovedDoctorForUser(user);
  let registryData = null;
  let verificationResult = 'LOOKUP_FAILED';
  let registryStatus = null;

  try {
    registryData = await abdmClient.lookupHprProfile(hprId);
    registryStatus = registryData?.status ?? 'ACTIVE';
    const docName = (doctor.personalDetails?.fullName || '').trim().toLowerCase();
    const hprName = (registryData?.name || '').trim().toLowerCase();
    verificationResult = hprName && docName && (hprName.includes(docName) || docName.includes(hprName))
      ? 'MATCH_FOUND'
      : hprName
        ? 'MISMATCH'
        : 'NOT_VERIFIED';
  } catch (err) {
    if (err.statusCode === 503) throw err;
    verificationResult = 'LOOKUP_FAILED';
  }

  const saved = await abdmRepository.upsertRegistryLink('HPR', doctor._id, {
    registryType: 'HPR',
    targetId: doctor._id,
    registryId: hprId,
    source: 'ABDM',
    lookupTimestamp: new Date(),
    registryStatus,
    metadata: registryData ?? {},
    verificationResult,
    adminReviewStatus: 'PENDING',
  });

  await recordAuditEvent({
    actorUserId: user._id,
    actorRole: user.role,
    action: AUDIT_ACTIONS.HPR_LINKED,
    targetType: AUDIT_TARGET_TYPES.DOCTOR_PROFILE,
    targetId: doctor._id,
    outcome: 'SUCCESS',
    requestId,
    metadata: { hprId, verificationResult },
  });

  return toPublicHprLink(saved);
};

export const getHprStatus = async (user) => {
  const doctor = await requireApprovedDoctorForUser(user);
  const link = await abdmRepository.findRegistryLink('HPR', doctor._id);
  return toPublicHprLink(link);
};
