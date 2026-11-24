import { abdmClient } from '../../../integrations/abdm/abdm.client.js';
import { abdmCrypto } from '../../../integrations/abdm/abdm.crypto.js';
import { ApiError } from '../../../utils/ApiError.js';
import { AUDIT_ACTIONS, AUDIT_TARGET_TYPES } from '../../auditLogs/auditLog.constants.js';
import { recordAuditEvent } from '../../auditLogs/auditLog.service.js';
import { abdmRepository } from '../abdm.repository.js';
import { ABHA_VERIFICATION_STATUS } from '../models/abhaLink.model.js';

export const toPublicAbhaStatus = (link) => {
  if (!link) {
    return {
      linked: false,
      provider: 'ABDM',
      verificationStatus: ABHA_VERIFICATION_STATUS.NOT_LINKED,
      abhaNumberMasked: null,
      abhaAddressMasked: null,
      linkedAt: null,
      verifiedAt: null,
    };
  }
  return {
    linked: link.verificationStatus === ABHA_VERIFICATION_STATUS.VERIFIED,
    provider: link.provider,
    verificationStatus: link.verificationStatus,
    abhaNumberMasked: link.abhaNumberMasked ?? null,
    abhaAddressMasked: link.abhaAddressMasked ?? null,
    linkedAt: link.linkedAt ?? null,
    verifiedAt: link.verifiedAt ?? null,
    consentStatus: link.consentStatus ?? 'NONE',
  };
};

export const initiateAbhaLink = async (user, { abhaNumber, abhaAddress }, requestId = null) => {
  const abhaNumberHash = abhaNumber ? abdmCrypto.hashIdentifier(abhaNumber.replace(/\D/g, '')) : null;
  const abhaAddressHash = abhaAddress ? abdmCrypto.hashIdentifier(abhaAddress) : null;

  const duplicate = await abdmRepository.findAbhaByHash({ abhaNumberHash, abhaAddressHash });
  if (duplicate && String(duplicate.patientId) !== String(user._id) && duplicate.verificationStatus === 'VERIFIED') {
    throw new ApiError(409, 'This ABHA identity is already linked to another account', 'ABHA_ALREADY_LINKED');
  }

  const gatewayRes = await abdmClient.initiateAbhaVerification({
    ...(abhaNumber ? { abhaNumber } : {}),
    ...(abhaAddress ? { abhaAddress } : {}),
  });

  const txnId = gatewayRes?.txnId;
  if (!txnId) {
    throw new ApiError(502, 'ABDM did not return a verification transaction ID', 'ABHA_INITIATE_FAILED');
  }

  const saved = await abdmRepository.upsertAbhaByPatientId(user._id, {
    abhaNumberMasked: abhaNumber ? abdmCrypto.maskAbhaNumber(abhaNumber) : null,
    abhaAddressMasked: abhaAddress ? abdmCrypto.maskAbhaAddress(abhaAddress) : null,
    verificationStatus: ABHA_VERIFICATION_STATUS.PENDING,
    pendingTxnId: txnId,
  });

  await recordAuditEvent({
    actorUserId: user._id,
    actorRole: user.role,
    action: AUDIT_ACTIONS.ABHA_LINK_INITIATED,
    targetType: AUDIT_TARGET_TYPES.ABHA_LINK,
    targetId: saved._id,
    outcome: 'SUCCESS',
    requestId,
  });

  return { txnId, status: toPublicAbhaStatus(saved) };
};

export const verifyAbhaLink = async (user, { txnId, otp }, requestId = null) => {
  const existing = await abdmRepository.findAbhaByPatientId(user._id);
  if (!existing || existing.pendingTxnId !== txnId) {
    throw new ApiError(400, 'No matching pending ABHA verification transaction', 'INVALID_ABHA_TXN');
  }

  let gatewayRes;
  try {
    gatewayRes = await abdmClient.verifyAbhaOtp({ txnId, otp });
  } catch (err) {
    await abdmRepository.upsertAbhaByPatientId(user._id, {
      verificationStatus: ABHA_VERIFICATION_STATUS.FAILED,
      pendingTxnId: null,
    });
    throw err;
  }

  const verifiedNumber = gatewayRes?.ABHANumber || gatewayRes?.abhaNumber || null;
  const verifiedAddress = gatewayRes?.abhaAddress || gatewayRes?.phrAddress || null;
  if (!gatewayRes?.verified && !verifiedNumber && !verifiedAddress) {
    await abdmRepository.upsertAbhaByPatientId(user._id, {
      verificationStatus: ABHA_VERIFICATION_STATUS.FAILED,
      pendingTxnId: null,
    });
    throw new ApiError(400, 'ABHA verification failed', 'ABHA_VERIFICATION_FAILED');
  }

  const abhaNumberHash = verifiedNumber ? abdmCrypto.hashIdentifier(verifiedNumber.replace(/\D/g, '')) : null;
  const abhaAddressHash = verifiedAddress ? abdmCrypto.hashIdentifier(verifiedAddress) : null;
  const duplicate = await abdmRepository.findAbhaByHash({ abhaNumberHash, abhaAddressHash });
  if (duplicate && String(duplicate.patientId) !== String(user._id) && duplicate.verificationStatus === 'VERIFIED') {
    throw new ApiError(409, 'This ABHA identity is already linked to another account', 'ABHA_ALREADY_LINKED');
  }

  const now = new Date();
  const saved = await abdmRepository.upsertAbhaByPatientId(user._id, {
    abhaNumberEncrypted: verifiedNumber ? abdmCrypto.encrypt(verifiedNumber) : null,
    abhaNumberHash: abhaNumberHash ?? undefined,
    abhaNumberMasked: verifiedNumber ? abdmCrypto.maskAbhaNumber(verifiedNumber) : existing.abhaNumberMasked,
    abhaAddressEncrypted: verifiedAddress ? abdmCrypto.encrypt(verifiedAddress) : null,
    abhaAddressHash: abhaAddressHash ?? undefined,
    abhaAddressMasked: verifiedAddress ? abdmCrypto.maskAbhaAddress(verifiedAddress) : existing.abhaAddressMasked,
    verificationStatus: ABHA_VERIFICATION_STATUS.VERIFIED,
    pendingTxnId: null,
    linkedAt: existing.linkedAt ?? now,
    verifiedAt: now,
    consentStatus: 'ACTIVE',
  });

  await recordAuditEvent({
    actorUserId: user._id,
    actorRole: user.role,
    action: AUDIT_ACTIONS.ABHA_LINKED,
    targetType: AUDIT_TARGET_TYPES.ABHA_LINK,
    targetId: saved._id,
    outcome: 'SUCCESS',
    requestId,
  });

  return toPublicAbhaStatus(saved);
};

export const getAbhaStatus = async (user) => {
  const link = await abdmRepository.findAbhaByPatientId(user._id);
  return toPublicAbhaStatus(link);
};

export const unlinkAbha = async (user, requestId = null) => {
  const existing = await abdmRepository.findAbhaByPatientId(user._id);
  if (!existing || existing.verificationStatus === ABHA_VERIFICATION_STATUS.REVOKED) {
    return toPublicAbhaStatus(existing);
  }

  const updated = await abdmRepository.upsertAbhaByPatientId(user._id, {
    abhaNumberEncrypted: null,
    abhaNumberHash: null,
    abhaAddressEncrypted: null,
    abhaAddressHash: null,
    pendingTxnId: null,
    verificationStatus: ABHA_VERIFICATION_STATUS.REVOKED,
    consentStatus: 'REVOKED',
  });

  await recordAuditEvent({
    actorUserId: user._id,
    actorRole: user.role,
    action: AUDIT_ACTIONS.ABHA_UNLINKED,
    targetType: AUDIT_TARGET_TYPES.ABHA_LINK,
    targetId: updated._id,
    outcome: 'SUCCESS',
    requestId,
  });

  return toPublicAbhaStatus(updated);
};
