import { NOTIFICATION_EVENT_TYPES } from '../notification.constants.js';

/**
 * Privacy-safe SMS templates (no diagnosis, symptoms, medical records, or shortened URLs).
 */
export const SMS_TEMPLATES = Object.freeze({
  [NOTIFICATION_EVENT_TYPES.APPOINTMENT_CONFIRMED]: ({
    recipientRole,
    patientFirstName,
    doctorName,
    date,
    time,
    clinicName,
    reference,
  }) =>
    recipientRole === 'DOCTOR'
      ? `MediBook: New appointment ${reference} with ${patientFirstName} on ${date} at ${time}${clinicName ? ` (${clinicName})` : ''}.`
      : `MediBook: Hi ${patientFirstName}, your appointment with ${doctorName} is confirmed for ${date} at ${time}${clinicName ? ` at ${clinicName}` : ''}. Ref: ${reference}. Reply STOP to opt out.`,

  [NOTIFICATION_EVENT_TYPES.APPOINTMENT_REMINDER_24H]: ({
    recipientRole,
    patientFirstName,
    doctorName,
    date,
    time,
    reference,
  }) =>
    recipientRole === 'DOCTOR'
      ? `MediBook Reminder: Appointment ${reference} with ${patientFirstName} tomorrow (${date}) at ${time}.`
      : `MediBook Reminder: Hi ${patientFirstName}, your appointment with ${doctorName} is in 24 hours (${date} at ${time}). Ref: ${reference}.`,

  [NOTIFICATION_EVENT_TYPES.APPOINTMENT_REMINDER_2H]: ({
    recipientRole,
    patientFirstName,
    doctorName,
    time,
    reference,
  }) =>
    recipientRole === 'DOCTOR'
      ? `MediBook Reminder: Upcoming appointment ${reference} with ${patientFirstName} in 2 hours at ${time}.`
      : `MediBook Reminder: Hi ${patientFirstName}, your appointment with ${doctorName} starts in 2 hours at ${time}. Ref: ${reference}.`,

  [NOTIFICATION_EVENT_TYPES.APPOINTMENT_CANCELLED]: ({
    recipientRole,
    patientFirstName,
    doctorName,
    date,
    time,
    reference,
  }) =>
    recipientRole === 'DOCTOR'
      ? `MediBook: Appointment ${reference} with ${patientFirstName} on ${date} at ${time} has been cancelled.`
      : `MediBook: Hi ${patientFirstName}, your appointment with ${doctorName} on ${date} at ${time} (Ref: ${reference}) has been cancelled.`,

  [NOTIFICATION_EVENT_TYPES.APPOINTMENT_RESCHEDULED]: ({
    recipientRole,
    patientFirstName,
    doctorName,
    date,
    time,
    reference,
  }) =>
    recipientRole === 'DOCTOR'
      ? `MediBook: Appointment ${reference} with ${patientFirstName} has been rescheduled to ${date} at ${time}.`
      : `MediBook: Hi ${patientFirstName}, your appointment with ${doctorName} has been rescheduled to ${date} at ${time}. Ref: ${reference}.`,
});
