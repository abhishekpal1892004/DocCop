import { abdmClient } from '../../../integrations/abdm/abdm.client.js';
import { ApiError } from '../../../utils/ApiError.js';
import { AUDIT_ACTIONS, AUDIT_TARGET_TYPES } from '../../auditLogs/auditLog.constants.js';
import { recordAuditEvent } from '../../auditLogs/auditLog.service.js';
import { getPermittedClinicById } from '../../clinics/clinic.service.js';
import { abdmRepository } from '../abdm.repository.js';

export const toPublicHfrLink = (link) =>
  link
    ? {
        id: String(link._id),
        clinicId: String(link.targetId),
        hfrId: link.registryId,
        facilityName: link.facilityName ?? null,
        facilityAddress: link.facilityAddress ?? null,
        lookupTimestamp: link.lookupTimestamp,
        registryStatus: link.registryStatus,
        verificationResult: link.verificationResult,
        adminReviewStatus: link.adminReviewStatus,
      }
    : null;

export const searchHfrFacility = async (user, { clinicId, hfrId }) => {
  const clinic = await getPermittedClinicById(user, clinicId);
  const cid = clinic.id || clinic._id;
  const registryData = await abdmClient.lookupHfrFacility(hfrId);
  const localName = (clinic.clinicName || '').trim().toLowerCase();
  const hfrName = (registryData?.facilityName || registryData?.name || '').trim().toLowerCase();

  return {
    clinicId: String(cid),
    hfrId,
    localClinicName: clinic.clinicName,
    registryFacilityName: registryData?.facilityName || registryData?.name || null,
    registryFacilityAddress: registryData?.address || null,
    nameMatches: Boolean(localName && hfrName && (localName.includes(hfrName) || hfrName.includes(localName))),
    registryData: registryData ?? null,
  };
};

export const linkHfrFacility = async (user, { clinicId, hfrId }, requestId = null) => {
  const clinic = await getPermittedClinicById(user, clinicId);
  const cid = clinic.id || clinic._id;
  let registryData = null;
  let verificationResult = 'LOOKUP_FAILED';

  try {
    registryData = await abdmClient.lookupHfrFacility(hfrId);
    const localName = (clinic.clinicName || '').trim().toLowerCase();
    const hfrName = (registryData?.facilityName || registryData?.name || '').trim().toLowerCase();
    verificationResult = hfrName && localName && (localName.includes(hfrName) || hfrName.includes(localName))
      ? 'MATCH_FOUND'
      : hfrName
        ? 'MISMATCH'
        : 'NOT_VERIFIED';
  } catch (err) {
    if (err.statusCode === 503) throw err;
    verificationResult = 'LOOKUP_FAILED';
  }

  // Note: HFR association never alters clinic.verificationStatus (Phase 4 statutory review remains independent).
  const saved = await abdmRepository.upsertRegistryLink('HFR', cid, {
    registryType: 'HFR',
    targetId: cid,
    registryId: hfrId,
    source: 'ABDM',
    lookupTimestamp: new Date(),
    registryStatus: registryData?.status ?? null,
    facilityName: registryData?.facilityName || registryData?.name || null,
    facilityAddress: typeof registryData?.address === 'string' ? registryData.address : JSON.stringify(registryData?.address ?? ''),
    metadata: registryData ?? {},
    verificationResult,
    adminReviewStatus: 'PENDING',
  });

  await recordAuditEvent({
    actorUserId: user._id,
    actorRole: user.role,
    action: AUDIT_ACTIONS.HFR_LINKED,
    targetType: AUDIT_TARGET_TYPES.CLINIC,
    targetId: cid,
    outcome: 'SUCCESS',
    requestId,
    metadata: { hfrId, verificationResult },
  });

  return toPublicHfrLink(saved);
};

export const getHfrStatus = async (user, clinicId) => {
  const clinic = await getPermittedClinicById(user, clinicId);
  const link = await abdmRepository.findRegistryLink('HFR', clinic.id || clinic._id);
  return toPublicHfrLink(link);
};
