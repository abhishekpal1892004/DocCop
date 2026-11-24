import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import { calendlyTokenService } from '../../integrations/calendly/calendly.token.service.js';
import { APPOINTMENT_STATUS } from '../appointments/appointment.constants.js';
import { appointmentRepository } from '../appointments/appointment.repository.js';
import { calendlyRepository } from '../calendly/calendly.repository.js';
import { NOTIFICATION_EVENT_TYPES } from '../notifications/notification.constants.js';
import { emitAppointmentNotificationEvent } from '../notifications/services/notification.service.js';
import { processWaitlistForCancelledAppointment } from '../waitlist/waitlist.service.js';
import { calendlyWebhookRepository } from './calendlyWebhook.repository.js';

const REPLAY_TOLERANCE_SEC = 300;

export const parseCalendlySignatureHeader = (header) => {
  if (!header || typeof header !== 'string') return null;
  const parts = header.split(',').map((p) => p.trim());
  let timestamp;
  let signature;
  for (const part of parts) {
    const [k, v] = part.split('=');
    if (k === 't') timestamp = v;
    if (k === 'v1') signature = v;
  }
  if (!timestamp || !signature) return null;
  return { timestamp, signature };
};

export const verifyCalendlyWebhookSignature = (rawBody, signatureHeader) => {
  const signingKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY || env.CALENDLY_WEBHOOK_SIGNING_KEY;
  if (!signingKey) {
    throw new ApiError(503, 'Calendly webhook signing key is not configured', 'WEBHOOK_NOT_CONFIGURED');
  }

  const parsed = parseCalendlySignatureHeader(signatureHeader);
  if (!parsed) {
    throw new ApiError(400, 'Missing or malformed Calendly-Webhook-Signature header', 'INVALID_WEBHOOK_SIGNATURE');
  }

  const tsNum = Number(parsed.timestamp);
  const nowSec = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(tsNum) || Math.abs(nowSec - tsNum) > REPLAY_TOLERANCE_SEC) {
    throw new ApiError(400, 'Calendly webhook timestamp is outside the allowed replay window', 'STALE_WEBHOOK_TIMESTAMP');
  }

  const rawText = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody ?? '');
  const expected = crypto
    .createHmac('sha256', signingKey)
    .update(`${parsed.timestamp}.${rawText}`, 'utf8')
    .digest('hex');

  const expectedBuf = Buffer.from(expected, 'hex');
  const receivedBuf = Buffer.from(parsed.signature, 'hex');
  if (expectedBuf.length !== receivedBuf.length || !crypto.timingSafeEqual(expectedBuf, receivedBuf)) {
    throw new ApiError(400, 'Invalid Calendly webhook signature', 'INVALID_WEBHOOK_SIGNATURE');
  }
};

const handleInviteeCreated = async (body) => {
  const payload = body?.payload ?? {};
  const inviteeUri = payload.uri;
  const eventUri = payload.event;
  if (!inviteeUri) return 'Ignored: missing invitee URI';

  const existing = await appointmentRepository.findByInviteeUri(inviteeUri);
  if (existing) {
    if (existing.status === APPOINTMENT_STATUS.PENDING_PROVIDER || existing.status === APPOINTMENT_STATUS.REQUIRES_RECONCILIATION) {
      await appointmentRepository.updateById(existing._id, {
        status: APPOINTMENT_STATUS.CONFIRMED,
        calendlyEventUri: eventUri ?? existing.calendlyEventUri,
      });
      return 'Reconciled existing appointment to CONFIRMED';
    }
    return 'Duplicate invitee.created ignored (already persisted)';
  }

  // Handle reschedule linkage when old_invitee is provided by Calendly.
  const oldInviteeUri = payload.old_invitee;
  let oldAppt = null;
  if (oldInviteeUri) {
    oldAppt = await appointmentRepository.findByInviteeUri(oldInviteeUri);
  }

  const scheduledEvent = payload.scheduled_event ?? {};
  const startAt = scheduledEvent.start_time ? new Date(scheduledEvent.start_time) : oldAppt?.startAt ?? new Date();
  const endAt = scheduledEvent.end_time ? new Date(scheduledEvent.end_time) : oldAppt?.endAt ?? new Date(startAt.getTime() + 30 * 60_000);

  if (oldAppt) {
    const newAppt = await appointmentRepository.upsertByInviteeUri(inviteeUri, {
      patientId: oldAppt.patientId,
      doctorId: oldAppt.doctorId,
      clinicId: oldAppt.clinicId,
      appointmentTypeId: oldAppt.appointmentTypeId,
      provider: 'CALENDLY',
      calendlyEventUri: eventUri,
      calendlyInviteeUri: inviteeUri,
      startAt,
      endAt,
      timezone: payload.timezone ?? oldAppt.timezone ?? 'UTC',
      status: APPOINTMENT_STATUS.CONFIRMED,
      rescheduledFromId: oldAppt._id,
      cancelUrlEncrypted: payload.cancel_url ? calendlyTokenService.encrypt(payload.cancel_url) : undefined,
      rescheduleUrlEncrypted: payload.reschedule_url ? calendlyTokenService.encrypt(payload.reschedule_url) : undefined,
    });

    await appointmentRepository.updateById(oldAppt._id, {
      status: APPOINTMENT_STATUS.RESCHEDULED,
      rescheduledToId: newAppt._id,
    });

    await emitAppointmentNotificationEvent({
      appointment: newAppt,
      eventType: NOTIFICATION_EVENT_TYPES.APPOINTMENT_RESCHEDULED,
      oldAppointmentId: oldAppt._id,
    });

    return 'Created rescheduled appointment and linked previous booking';
  }

  // Fallback: match doctor via event memberships or created_by
  const ownerUri = body?.created_by ?? scheduledEvent?.event_memberships?.[0]?.user;
  if (ownerUri) {
    const conn = await calendlyRepository.findConnectionByUserUri(ownerUri);
    if (conn) {
      return `Matched doctor connection ${conn.doctorId}; no local booking attempt to attach`;
    }
  }

  return 'No matching local appointment or reschedule reference found';
};

const handleInviteeCanceled = async (body) => {
  const payload = body?.payload ?? {};
  const inviteeUri = payload.uri;
  const eventUri = payload.event;

  const appt =
    (inviteeUri ? await appointmentRepository.findByInviteeUri(inviteeUri) : null) ??
    (eventUri ? await appointmentRepository.findByEventUri(eventUri) : null);

  if (!appt) return 'Ignored: no matching local appointment found';

  const isReschedule = Boolean(payload.rescheduled || payload.new_invitee);
  if (isReschedule) {
    if (appt.status !== APPOINTMENT_STATUS.RESCHEDULED) {
      await appointmentRepository.updateById(appt._id, { status: APPOINTMENT_STATUS.RESCHEDULED });
    }
    return 'Marked appointment as RESCHEDULED';
  }

  if (appt.status === APPOINTMENT_STATUS.CANCELLED || appt.status === APPOINTMENT_STATUS.RESCHEDULED) {
    return `Out-of-order/duplicate cancel ignored (already ${appt.status})`;
  }

  const reason = payload.cancellation?.reason ?? 'Cancelled via Calendly';
  const updated = await appointmentRepository.updateById(appt._id, {
    status: APPOINTMENT_STATUS.CANCELLED,
    cancellationReason: reason,
  });
  await emitAppointmentNotificationEvent({
    appointment: updated,
    eventType: NOTIFICATION_EVENT_TYPES.APPOINTMENT_CANCELLED,
  });
  await processWaitlistForCancelledAppointment(updated);
  return 'Marked appointment as CANCELLED';
};

export const processCalendlyWebhook = async ({ rawBody, signatureHeader }) => {
  verifyCalendlyWebhookSignature(rawBody, signatureHeader);

  let body;
  try {
    const text = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody ?? '');
    body = JSON.parse(text);
  } catch {
    throw new ApiError(400, 'Malformed webhook JSON payload', 'INVALID_JSON');
  }

  const eventType = body?.event ?? 'unknown';
  const inviteeUri = body?.payload?.uri ?? '';
  const scheduledEventUri = body?.payload?.event ?? '';
  const createdAt = body?.created_at ?? '';
  const dedupKey = `${eventType}:${inviteeUri}:${createdAt}`;

  const existing = await calendlyWebhookRepository.findByDedupKey(dedupKey);
  if (existing && existing.processingStatus === 'PROCESSED') {
    return { duplicate: true, status: 'PROCESSED', result: existing.processingResult };
  }

  let inbox = existing;
  if (!inbox) {
    try {
      inbox = await calendlyWebhookRepository.create({
        provider: 'CALENDLY',
        dedupKey,
        eventType,
        inviteeUri,
        scheduledEventUri,
        processingStatus: 'RECEIVED',
        payload: {
          event: eventType,
          created_at: createdAt,
          uri: inviteeUri,
          scheduledEventUri,
          rescheduled: body?.payload?.rescheduled ?? false,
          old_invitee: body?.payload?.old_invitee ?? null,
          new_invitee: body?.payload?.new_invitee ?? null,
        },
      });
    } catch (err) {
      if (err?.code === 11000) {
        return { duplicate: true, status: 'PROCESSED' };
      }
      throw err;
    }
  }

  try {
    let result;
    let status = 'PROCESSED';
    if (eventType === 'invitee.created') {
      result = await handleInviteeCreated(body);
    } else if (eventType === 'invitee.canceled') {
      result = await handleInviteeCanceled(body);
    } else {
      status = 'IGNORED';
      result = `Unsupported event type: ${eventType}`;
    }

    await calendlyWebhookRepository.updateById(inbox._id, {
      processingStatus: status,
      processingResult: result,
    });

    return { duplicate: false, status, result };
  } catch (err) {
    await calendlyWebhookRepository.updateById(inbox._id, {
      processingStatus: 'FAILED',
      errorDetails: String(err?.message ?? 'Unknown processing error').slice(0, 1000),
    });
    throw err;
  }
};
