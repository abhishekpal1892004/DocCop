import { NOTIFICATION_EVENT_TYPES } from '../notification.constants.js';
import { SMS_TEMPLATES } from '../templates/sms.templates.js';
import { buildWhatsAppContentVariables, getWhatsAppContentSid } from '../templates/whatsapp.templates.js';

const formatInTimezone = (date, timezone = 'UTC') => {
  const d = new Date(date);
  try {
    return {
      date: new Intl.DateTimeFormat('en-IN', {
        timeZone: timezone,
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(d),
      time: new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(d),
    };
  } catch {
    return {
      date: d.toISOString().slice(0, 10),
      time: d.toISOString().slice(11, 16) + ' UTC',
    };
  }
};

const IN_APP_TITLES = Object.freeze({
  [NOTIFICATION_EVENT_TYPES.APPOINTMENT_CONFIRMED]: 'Appointment Confirmed',
  [NOTIFICATION_EVENT_TYPES.APPOINTMENT_REMINDER_24H]: '24-Hour Appointment Reminder',
  [NOTIFICATION_EVENT_TYPES.APPOINTMENT_REMINDER_2H]: '2-Hour Appointment Reminder',
  [NOTIFICATION_EVENT_TYPES.APPOINTMENT_CANCELLED]: 'Appointment Cancelled',
  [NOTIFICATION_EVENT_TYPES.APPOINTMENT_RESCHEDULED]: 'Appointment Rescheduled',
});

export const notificationTemplateService = {
  buildContext({ appointment, patientUser, doctorProfile, clinicName, recipientRole }) {
    const { date, time } = formatInTimezone(appointment.startAt, appointment.timezone ?? 'UTC');
    const patientFirstName =
      patientUser?.firstName ||
      String(patientUser?.fullName ?? 'Patient').split(/\s+/)[0] ||
      'Patient';
    const doctorName = doctorProfile?.personalDetails?.fullName ?? 'Doctor';
    const reference = `MB-${String(appointment._id).slice(-6).toUpperCase()}`;

    return {
      recipientRole,
      patientFirstName,
      doctorName,
      date,
      time,
      clinicName: clinicName ?? doctorProfile?.clinicDetails?.clinicName ?? '',
      reference,
    };
  },

  renderSms(eventType, context) {
    const fn = SMS_TEMPLATES[eventType];
    return fn ? fn(context) : `MediBook: Update for appointment ${context.reference}.`;
  },

  renderWhatsApp(eventType, context) {
    return {
      contentSid: getWhatsAppContentSid(eventType),
      contentVariables: buildWhatsAppContentVariables(context),
    };
  },

  renderInApp(eventType, context) {
    return {
      title: IN_APP_TITLES[eventType] ?? 'Appointment Update',
      messageBody: this.renderSms(eventType, context),
    };
  },
};
