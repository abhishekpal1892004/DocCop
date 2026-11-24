import { env } from '../../config/env.js';
import { E164_REGEX } from '../../modules/patients/patient.constants.js';
import { twilioClientGateway } from './twilio.client.js';
import { classifyTwilioError, TwilioSendError } from './twilio.sms.service.js';

export const formatWhatsAppAddress = (phoneNumber) => {
  const clean = String(phoneNumber ?? '').replace(/^whatsapp:/i, '').trim();
  if (!E164_REGEX.test(clean)) {
    throw new TwilioSendError('Invalid WhatsApp recipient phone number (E.164 required)', {
      code: 'INVALID_PHONE_NUMBER',
      permanent: true,
    });
  }
  return `whatsapp:${clean}`;
};

export const twilioWhatsappService = {
  async sendTemplate({ to, contentSid, contentVariables }) {
    if (!contentSid) {
      throw new TwilioSendError('WhatsApp ContentSid is not configured for this template', {
        code: 'WHATSAPP_TEMPLATE_NOT_CONFIGURED',
        permanent: true,
      });
    }
    if (!contentVariables || typeof contentVariables !== 'object' || Array.isArray(contentVariables)) {
      throw new TwilioSendError('Invalid WhatsApp ContentVariables payload', {
        code: 'INVALID_CONTENT_VARIABLES',
        permanent: true,
      });
    }

    const from = process.env.TWILIO_WHATSAPP_FROM || env.TWILIO_WHATSAPP_FROM;
    if (!from || !String(from).startsWith('whatsapp:')) {
      throw new TwilioSendError('TWILIO_WHATSAPP_FROM must be configured with whatsapp: prefix', {
        code: 'WHATSAPP_SENDER_NOT_CONFIGURED',
        permanent: true,
      });
    }

    const formattedTo = formatWhatsAppAddress(to);
    const statusCallback = process.env.TWILIO_STATUS_CALLBACK_URL || env.TWILIO_STATUS_CALLBACK_URL;

    // Never combine body or mediaUrl when using ContentSid templates.
    const payload = {
      from,
      to: formattedTo,
      contentSid,
      contentVariables: JSON.stringify(contentVariables),
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
