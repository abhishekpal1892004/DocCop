import crypto from 'node:crypto';
import { env } from '../../../config/env.js';
import { ApiError } from '../../../utils/ApiError.js';
import { AUDIT_ACTIONS, AUDIT_TARGET_TYPES } from '../../auditLogs/auditLog.constants.js';
import { recordAuditEvent } from '../../auditLogs/auditLog.service.js';
import { validateFhirBundle } from '../../interoperability/fhir/fhir.validator.js';
import { abdmRepository } from '../abdm.repository.js';
import { ABDM_CONSENT_STATUS } from '../models/abdmConsent.model.js';
import { ABDM_EXCHANGE_STATUS } from '../models/abdmExchange.model.js';

const MAX_WEBHOOK_SKEW_MS = 5 * 60 * 1000;

export const verifyAbdmWebhookSignature = ({ rawBody, signature, timestamp }) => {
  const secret = process.env.ABDM_WEBHOOK_SECRET || env.ABDM_WEBHOOK_SECRET;
  if (!secret) {
    throw new ApiError(503, 'ABDM webhook secret is not configured', 'ABDM_WEBHOOK_NOT_CONFIGURED');
  }
  if (!signature || !timestamp) {
    throw new ApiError(401, 'Missing ABDM webhook signature or timestamp', 'INVALID_ABDM_SIGNATURE');
  }

  const tsMs = Date.parse(timestamp);
  if (!Number.isFinite(tsMs) || Math.abs(Date.now() - tsMs) > MAX_WEBHOOK_SKEW_MS) {
    throw new ApiError(401, 'ABDM webhook timestamp is outside replay window', 'REPLAY_DETECTED');
  }

  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  const sigBuf = Buffer.from(String(signature), 'utf8');
  const expBuf = Buffer.from(expected, 'utf8');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    throw new ApiError(401, 'Invalid ABDM webhook signature', 'INVALID_ABDM_SIGNATURE');
  }
};

export const processAbdmWebhookEvent = async (payload) => {
  const eventId = payload?.eventId || payload?.requestId;
  const eventType = payload?.eventType;
  if (!eventId || !eventType) {
    throw new ApiError(400, 'Webhook payload requires eventId and eventType', 'INVALID_WEBHOOK_PAYLOAD');
  }

  const existing = await abdmRepository.findWebhookByEventId(eventId);
  if (existing) {
    return { duplicate: true, eventId, status: existing.processingStatus };
  }

  const eventDoc = await abdmRepository.createWebhookEvent({
    eventId,
    requestId: payload.requestId || eventId,
    eventType,
    timestamp: payload.timestamp ? new Date(payload.timestamp) : new Date(),
    processingStatus: 'RECEIVED',
  });

  try {
    if (eventType === 'CONSENT_NOTIFICATION') {
      const consent =
        (payload.consentRequestId && (await abdmRepository.findConsentByRequestId(payload.consentRequestId))) ||
        (payload.consentManagerReference &&
          (await abdmRepository.findConsentByManagerRef(payload.consentManagerReference)));

      if (consent) {
        const nextStatus = payload.status;
        const terminalBlocked = ['REJECTED', 'DENIED', 'REVOKED'].includes(consent.status) && nextStatus === 'GRANTED';
        if (!terminalBlocked && Object.values(ABDM_CONSENT_STATUS).includes(nextStatus)) {
          await abdmRepository.updateConsentById(consent._id, {
            status: nextStatus,
            consentManagerReference: payload.consentManagerReference || consent.consentManagerReference,
            ...(nextStatus === 'GRANTED' ? { grantedAt: new Date() } : {}),
            ...(nextStatus === 'REVOKED' ? { revokedAt: new Date() } : {}),
          });
        }
      }
    } else if (eventType === 'HIP_LINK_ACK') {
      const ex = payload.requestId ? await abdmRepository.findExchangeByRequestId(payload.requestId) : null;
      if (ex) {
        await abdmRepository.updateExchangeById(ex._id, {
          status: payload.error ? ABDM_EXCHANGE_STATUS.FAILED : ABDM_EXCHANGE_STATUS.COMPLETED,
          errorMessage: payload.error || null,
        });
      }
    } else if (eventType === 'HIU_DATA_PUSH') {
      const ex = payload.transactionId
        ? await abdmRepository.findExchangeByTransactionId(payload.transactionId)
        : payload.requestId
          ? await abdmRepository.findExchangeByRequestId(payload.requestId)
          : null;

      if (ex) {
        const consent = ex.consentReference
          ? await abdmRepository.findConsentByManagerRef(ex.consentReference)
          : null;
        if (consent && consent.status !== ABDM_CONSENT_STATUS.GRANTED) {
          await abdmRepository.updateExchangeById(ex._id, {
            status: ABDM_EXCHANGE_STATUS.REVOKED,
            errorMessage: 'Consent is no longer active',
          });
        } else if (payload.bundle) {
          const check = validateFhirBundle(payload.bundle);
          if (!check.valid) {
            await abdmRepository.updateExchangeById(ex._id, {
              status: ABDM_EXCHANGE_STATUS.FAILED,
              errorMessage: `Invalid inbound FHIR bundle: ${check.errors.join('; ')}`,
            });
          } else {
            const extBundleId = payload.bundle.id || payload.eventId;
            const existingImport = await abdmRepository.findFhirImportByBundle(ex.patientId, extBundleId);
            if (!existingImport) {
              await abdmRepository.createFhirImport({
                patientId: ex.patientId,
                exchangeId: ex._id,
                consentReference: ex.consentReference || ex.requestId,
                externalBundleId: extBundleId,
                sourceHipId: payload.hipId || 'EXTERNAL_HIP',
                resourceSummary: {
                  entryCount: payload.bundle.entry?.length || 0,
                  resourceTypes: [...new Set((payload.bundle.entry || []).map((e) => e.resource?.resourceType).filter(Boolean))],
                },
                validationStatus: 'VALID',
                isExternal: true,
              });
            }
            await abdmRepository.updateExchangeById(ex._id, {
              status: ABDM_EXCHANGE_STATUS.COMPLETED,
              retrievedBundleSummary: {
                bundleId: extBundleId,
                entryCount: payload.bundle.entry?.length || 0,
                receivedAt: new Date().toISOString(),
              },
            });
          }
        }
      }
    }

    await abdmRepository.updateWebhookById(eventDoc._id, { processingStatus: 'PROCESSED' });
    await recordAuditEvent({
      actorUserId: '000000000000000000000000',
      actorRole: 'SYSTEM',
      action: AUDIT_ACTIONS.ABDM_WEBHOOK_RECEIVED,
      targetType: AUDIT_TARGET_TYPES.ABDM_WEBHOOK,
      targetId: eventDoc._id,
      outcome: 'SUCCESS',
      metadata: { eventType, eventId },
    });

    return { duplicate: false, eventId, status: 'PROCESSED' };
  } catch (err) {
    await abdmRepository.updateWebhookById(eventDoc._id, {
      processingStatus: 'FAILED',
      errorMessage: err.message,
    });
    throw err;
  }
};
