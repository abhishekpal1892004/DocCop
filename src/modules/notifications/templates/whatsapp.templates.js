import { env } from '../../../config/env.js';
import { NOTIFICATION_EVENT_TYPES } from '../notification.constants.js';

export const getWhatsAppContentSid = (eventType) => {
  switch (eventType) {
    case NOTIFICATION_EVENT_TYPES.APPOINTMENT_CONFIRMED:
      return process.env.TWILIO_CONTENT_SID_APPOINTMENT_CONFIRMED || env.TWILIO_CONTENT_SID_APPOINTMENT_CONFIRMED;
    case NOTIFICATION_EVENT_TYPES.APPOINTMENT_REMINDER_24H:
    case NOTIFICATION_EVENT_TYPES.APPOINTMENT_REMINDER_2H:
      return process.env.TWILIO_CONTENT_SID_APPOINTMENT_REMINDER || env.TWILIO_CONTENT_SID_APPOINTMENT_REMINDER;
    case NOTIFICATION_EVENT_TYPES.APPOINTMENT_CANCELLED:
      return process.env.TWILIO_CONTENT_SID_APPOINTMENT_CANCELLED || env.TWILIO_CONTENT_SID_APPOINTMENT_CANCELLED;
    case NOTIFICATION_EVENT_TYPES.APPOINTMENT_RESCHEDULED:
      return process.env.TWILIO_CONTENT_SID_APPOINTMENT_RESCHEDULED || env.TWILIO_CONTENT_SID_APPOINTMENT_RESCHEDULED;
    default:
      return undefined;
  }
};

export const buildWhatsAppContentVariables = ({
  patientFirstName,
  doctorName,
  date,
  time,
  reference,
}) => ({
  1: String(patientFirstName ?? 'Patient'),
  2: String(doctorName ?? 'Doctor'),
  3: String(date ?? ''),
  4: String(time ?? ''),
  5: String(reference ?? ''),
});
