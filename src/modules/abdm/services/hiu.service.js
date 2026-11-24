import crypto from 'node:crypto';
import { abdmClient } from '../../../integrations/abdm/abdm.client.js';
import { getAbdmRuntimeConfig } from '../../../integrations/abdm/abdm.config.js';
import { abdmCrypto } from '../../../integrations/abdm/abdm.crypto.js';
import { ApiError } from '../../../utils/ApiError.js';
import { AUDIT_ACTIONS, AUDIT_TARGET_TYPES } from '../../auditLogs/auditLog.constants.js';
import { recordAuditEvent } from '../../auditLogs/auditLog.service.js';
import { ROLES } from '../../users/user.constants.js';
import { abdmRepository } from '../abdm.repository.js';
import { ABDM_CONSENT_STATUS } from '../models/abdmConsent.model.js';
import { ABDM_EXCHANGE_STATUS } from '../models/abdmExchange.model.js';
import { toPublicExchange } from './hip.service.js';

export const discoverExternalRecords = async (user, { hipId }) => {
  const abhaLink = await abdmRepository.findAbhaByPatientId(user._id);
  if (!abhaLink || abhaLink.verificationStatus !== 'VERIFIED') {
    throw new ApiError(400, 'Verified ABHA link is required for care-context discovery', 'ABHA_NOT_LINKED');
  }

  const abhaAddress = abhaLink.abhaAddressEncrypted
    ? abdmCrypto.decrypt(abhaLink.abhaAddressEncrypted)
    : abdmCrypto.decrypt(abhaLink.abhaNumberEncrypted);

  return abdmClient.hiuDiscoverCareContexts({
    hipId,
    patient: { id: abhaAddress },
  });
};

export const requestExternalHealthData = async (user, { consentId }, requestId = null) => {
  const consent = await abdmRepository.findConsentById(consentId);
  if (!consent) throw new ApiError(404, 'Consent record not found', 'CONSENT_NOT_FOUND');

  if (
    user.role !== ROLES.ADMIN &&
    String(consent.patientId) !== String(user._id) &&
    String(consent.requesterId) !== String(user._id)
  ) {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }

  if (consent.status !== ABDM_CONSENT_STATUS.GRANTED) {
    throw new ApiError(403, `Cannot request health data when consent status is ${consent.status}`, 'CONSENT_NOT_GRANTED');
  }

  if (new Date(consent.expiresAt) <= new Date()) {
    await abdmRepository.updateConsentById(consent._id, { status: ABDM_CONSENT_STATUS.EXPIRED });
    throw new ApiError(403, 'Consent has expired', 'CONSENT_EXPIRED');
  }

  const cfg = getAbdmRuntimeConfig();
  const transactionId = crypto.randomUUID();
  const abdmRequestId = crypto.randomUUID();

  await abdmClient.hiuRequestHealthInformation({
    requestId: abdmRequestId,
    hiRequest: {
      consent: { id: consent.consentManagerReference || consent.consentRequestId },
      dateRange: consent.dateRange,
      dataPushUrl: cfg.callbackBaseUrl ? `${cfg.callbackBaseUrl}/api/v1/webhooks/abdm` : undefined,
    },
  });

  const exchange = await abdmRepository.createExchange({
    patientId: consent.patientId,
    recordSourceType: 'EXTERNAL',
    direction: 'INBOUND',
    role: 'HIU',
    transactionId,
    requestId: abdmRequestId,
    consentReference: consent.consentManagerReference || consent.consentRequestId,
    recordType: consent.recordTypes.join(','),
    facilityId: cfg.facilityId || null,
    status: ABDM_EXCHANGE_STATUS.INITIATED,
  });

  await recordAuditEvent({
    actorUserId: user._id,
    actorRole: user.role,
    action: AUDIT_ACTIONS.ABDM_HIU_DATA_REQUESTED,
    targetType: AUDIT_TARGET_TYPES.ABDM_EXCHANGE,
    targetId: exchange._id,
    outcome: 'SUCCESS',
    requestId,
  });

  return toPublicExchange(exchange);
};

export const getHiuExchangeStatus = async (user, exchangeId) => {
  const existing = await abdmRepository.findExchangeById(exchangeId);
  if (!existing || existing.role !== 'HIU') {
    throw new ApiError(404, 'HIU exchange record not found', 'EXCHANGE_NOT_FOUND');
  }
  if (user.role !== ROLES.ADMIN && String(existing.patientId) !== String(user._id)) {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }
  return toPublicExchange(existing);
};

export const listMyImportedFhirRecords = async (user) => {
  const items = await abdmRepository.listFhirImportsByPatient(user._id);
  return items.map((item) => ({
    id: String(item._id),
    exchangeId: String(item.exchangeId),
    consentReference: item.consentReference,
    externalBundleId: item.externalBundleId,
    sourceHipId: item.sourceHipId,
    resourceSummary: item.resourceSummary,
    validationStatus: item.validationStatus,
    isExternal: true,
    importedAt: item.importedAt,
  }));
};
