import { env } from '../../../config/env.js';
import { twilioSmsService } from '../../../integrations/twilio/twilio.sms.service.js';
import { twilioWhatsappService } from '../../../integrations/twilio/twilio.whatsapp.service.js';
import { mapTwilioStatus } from '../../../integrations/twilio/twilio.webhook.service.js';
import { APPOINTMENT_STATUS } from '../../appointments/appointment.constants.js';
import { appointmentRepository } from '../../appointments/appointment.repository.js';
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EVENT_TYPES,
  NOTIFICATION_STATUS,
  WORKER_LEASE_MS,
} from '../notification.constants.js';
import { notificationRepository } from '../notification.repository.js';

const REMINDER_EVENTS = new Set([
  NOTIFICATION_EVENT_TYPES.APPOINTMENT_REMINDER_24H,
  NOTIFICATION_EVENT_TYPES.APPOINTMENT_REMINDER_2H,
]);

const isConsentStillActive = async (job) => {
  const pref = await notificationRepository.findPreferenceByUserId(job.userId);
  if (!pref) return false;
  if (job.channel === NOTIFICATION_CHANNELS.SMS) return Boolean(pref.sms?.enabled && pref.sms?.optedIn);
  if (job.channel === NOTIFICATION_CHANNELS.WHATSAPP) return Boolean(pref.whatsapp?.enabled && pref.whatsapp?.optedIn);
  return true;
};

export const processNotificationJob = async (job) => {
  // Re-verify appointment state & consent before sending reminders.
  if (REMINDER_EVENTS.has(job.eventType)) {
    const appt = await appointmentRepository.findById(job.appointmentId);
    if (!appt || appt.status !== APPOINTMENT_STATUS.CONFIRMED) {
      await notificationRepository.updateById(job._id, {
        status: NOTIFICATION_STATUS.CANCELLED,
        lockUntil: null,
        lastErrorMessage: 'Appointment is no longer confirmed',
      });
      return { outcome: 'CANCELLED' };
    }
  }

  const consentOk = await isConsentStillActive(job);
  if (!consentOk) {
    await notificationRepository.updateById(job._id, {
      status: NOTIFICATION_STATUS.CANCELLED,
      lockUntil: null,
      lastErrorMessage: 'Recipient opted out or consent missing',
    });
    return { outcome: 'CANCELLED' };
  }

  try {
    let result;
    if (job.channel === NOTIFICATION_CHANNELS.SMS) {
      result = await twilioSmsService.send({ to: job.recipient, body: job.messageBody });
    } else if (job.channel === NOTIFICATION_CHANNELS.WHATSAPP) {
      result = await twilioWhatsappService.sendTemplate({
        to: job.recipient,
        contentSid: job.contentSid,
        contentVariables: job.contentVariables,
      });
    } else {
      await notificationRepository.updateById(job._id, {
        status: NOTIFICATION_STATUS.SENT,
        sentAt: new Date(),
        lockUntil: null,
      });
      return { outcome: 'SENT' };
    }

    const mapped = mapTwilioStatus(result.status);
    await notificationRepository.updateById(job._id, {
      providerMessageSid: result.sid,
      status: mapped === NOTIFICATION_STATUS.PROCESSING ? NOTIFICATION_STATUS.QUEUED : mapped,
      sentAt: new Date(),
      lockUntil: null,
    });
    return { outcome: 'DISPATCHED', sid: result.sid };
  } catch (err) {
    if (err?.ambiguous) {
      await notificationRepository.updateById(job._id, {
        status: NOTIFICATION_STATUS.UNKNOWN,
        lockUntil: null,
        lastErrorCode: err.code ?? 'TWILIO_TIMEOUT',
        lastErrorMessage: err.message,
      });
      return { outcome: 'UNKNOWN' };
    }

    const maxAttempts = job.maxAttempts ?? env.NOTIFICATION_MAX_ATTEMPTS;
    if (err?.permanent || (job.attemptCount ?? 1) >= maxAttempts) {
      await notificationRepository.updateById(job._id, {
        status: NOTIFICATION_STATUS.FAILED,
        failedAt: new Date(),
        lockUntil: null,
        lastErrorCode: String(err?.code ?? 'TWILIO_ERROR'),
        lastErrorMessage: String(err?.message ?? 'Notification failed').slice(0, 500),
      });
      return { outcome: 'FAILED' };
    }

    const delayMs =
      env.NOTIFICATION_RETRY_BASE_SECONDS * 1000 * Math.pow(2, Math.max(0, (job.attemptCount ?? 1) - 1));
    await notificationRepository.updateById(job._id, {
      status: NOTIFICATION_STATUS.QUEUED,
      nextAttemptAt: new Date(Date.now() + delayMs),
      lockUntil: null,
      lastErrorCode: String(err?.code ?? 'RETRYABLE_ERROR'),
      lastErrorMessage: String(err?.message ?? 'Scheduled for retry').slice(0, 500),
    });
    return { outcome: 'RETRY_SCHEDULED' };
  }
};

export const runNotificationBatch = async ({ limit = 25, now = new Date() } = {}) => {
  const results = [];
  for (let i = 0; i < limit; i += 1) {
    const leaseUntil = new Date(Date.now() + WORKER_LEASE_MS);
    const job = await notificationRepository.claimNextDueJob(now, leaseUntil);
    if (!job) break;
    const res = await processNotificationJob(job);
    results.push({ id: String(job._id), ...res });
  }
  return results;
};
