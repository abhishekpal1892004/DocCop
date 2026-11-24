import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import { NOTIFICATION_STATUS } from '../../modules/notifications/notification.constants.js';
import { twilioClientGateway } from './twilio.client.js';

const TWILIO_TO_MEDIBOOK_STATUS = Object.freeze({
  queued: NOTIFICATION_STATUS.QUEUED,
  accepted: NOTIFICATION_STATUS.QUEUED,
  sending: NOTIFICATION_STATUS.PROCESSING,
  sent: NOTIFICATION_STATUS.SENT,
  delivered: NOTIFICATION_STATUS.DELIVERED,
  read: NOTIFICATION_STATUS.READ,
  undelivered: NOTIFICATION_STATUS.UNDELIVERED,
  failed: NOTIFICATION_STATUS.FAILED,
  canceled: NOTIFICATION_STATUS.CANCELLED,
});

const STATUS_RANK = Object.freeze({
  [NOTIFICATION_STATUS.SCHEDULED]: 1,
  [NOTIFICATION_STATUS.QUEUED]: 2,
  [NOTIFICATION_STATUS.PROCESSING]: 3,
  [NOTIFICATION_STATUS.UNKNOWN]: 3,
  [NOTIFICATION_STATUS.SENT]: 4,
  [NOTIFICATION_STATUS.DELIVERED]: 5,
  [NOTIFICATION_STATUS.READ]: 6,
  [NOTIFICATION_STATUS.UNDELIVERED]: 6,
  [NOTIFICATION_STATUS.FAILED]: 6,
  [NOTIFICATION_STATUS.CANCELLED]: 7,
});

export const mapTwilioStatus = (providerStatus) =>
  TWILIO_TO_MEDIBOOK_STATUS[String(providerStatus ?? '').toLowerCase()] ?? NOTIFICATION_STATUS.UNKNOWN;

export const shouldAdvanceStatus = (currentStatus, nextStatus) => {
  const curRank = STATUS_RANK[currentStatus] ?? 0;
  const nextRank = STATUS_RANK[nextStatus] ?? 0;
  return nextRank > curRank;
};

export const verifyTwilioWebhookRequest = (req) => {
  const signature = req.get('X-Twilio-Signature');
  if (!signature) {
    throw new ApiError(403, 'Missing X-Twilio-Signature header', 'INVALID_TWILIO_SIGNATURE');
  }

  const configuredUrl = process.env.TWILIO_STATUS_CALLBACK_URL || env.TWILIO_STATUS_CALLBACK_URL;
  const protocol = req.get('x-forwarded-proto') || req.protocol;
  const host = req.get('x-forwarded-host') || req.get('host');
  const computedUrl = host ? `${protocol}://${host}${req.originalUrl}` : null;

  const candidateUrls = [configuredUrl, computedUrl].filter(Boolean);
  const valid = candidateUrls.some((url) =>
    twilioClientGateway.validateRequest(signature, url, req.body ?? {})
  );

  if (!valid) {
    throw new ApiError(403, 'Invalid Twilio webhook signature', 'INVALID_TWILIO_SIGNATURE');
  }
};
