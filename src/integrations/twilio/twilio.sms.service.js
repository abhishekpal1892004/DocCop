import { env } from '../../config/env.js';
import { E164_REGEX } from '../../modules/patients/patient.constants.js';
import { twilioClientGateway } from './twilio.client.js';

const PERMANENT_TWILIO_CODES = new Set([21211, 21214, 21408, 21610, 21614, 21612, 30006, 63016]);

export class TwilioSendError extends Error {
  constructor(message, { code = 'TWILIO_ERROR', permanent = false, ambiguous = false } = {}) {
    super(message);
    this.name = 'TwilioSendError';
    this.code = String(code);
    this.permanent = permanent;
    this.ambiguous = ambiguous;
  }
}

export const classifyTwilioError = (err) => {
  if (err instanceof TwilioSendError) return err;
  const code = err?.code ?? err?.status;
  const isTimeout =
    err?.code === 'ETIMEDOUT' ||
    err?.code === 'ECONNABORTED' ||
    err?.code === 'ESOCKETTIMEDOUT' ||
    Number(err?.status) >= 500;

  if (isTimeout) {
    return new TwilioSendError(err?.message || 'Twilio request timed out', {
      code: code ?? 'TWILIO_TIMEOUT',
      ambiguous: true,
    });
  }

  const numericCode = Number(err?.code);
  const permanent = PERMANENT_TWILIO_CODES.has(numericCode) || err?.status === 400 || err?.status === 404;
  return new TwilioSendError(err?.message || 'Twilio messaging error', {
    code: code ?? 'TWILIO_ERROR',
    permanent,
  });
};

export const twilioSmsService = {
  async send({ to, body }) {
    if (!E164_REGEX.test(String(to ?? ''))) {
      throw new TwilioSendError('Invalid recipient phone number (E.164 required)', {
        code: 'INVALID_PHONE_NUMBER',
        permanent: true,
      });
    }

    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID || env.TWILIO_MESSAGING_SERVICE_SID;
    const fromNumber = process.env.TWILIO_SMS_FROM_NUMBER || env.TWILIO_SMS_FROM_NUMBER;
    const statusCallback = process.env.TWILIO_STATUS_CALLBACK_URL || env.TWILIO_STATUS_CALLBACK_URL;

    if (!messagingServiceSid && !fromNumber) {
      throw new TwilioSendError('Twilio SMS sender (MessagingServiceSid or From number) is not configured', {
        code: 'TWILIO_SENDER_NOT_CONFIGURED',
        permanent: true,
      });
    }

    const payload = {
      to,
      body,
      ...(messagingServiceSid ? { messagingServiceSid } : { from: fromNumber }),
      ...(statusCallback ? { statusCallback } : {}),
    };

    try {
      const msg = await twilioClientGateway.createMessage(payload);
      return {
        sid: msg.sid,
        status: msg.status ?? 'queued',
      };
    } catch (err) {
      throw classifyTwilioError(err);
    }
  },
};
