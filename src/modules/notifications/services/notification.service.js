import { ApiError } from '../../../utils/ApiError.js';
import { APPOINTMENT_STATUS } from '../../appointments/appointment.constants.js';
import { clinicRepository } from '../../clinics/clinic.repository.js';
import { doctorRepository } from '../../doctors/doctor.repository.js';
import { userRepository } from '../../users/user.repository.js';
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EVENT_TYPES,
  NOTIFICATION_PROVIDERS,
  NOTIFICATION_STATUS,
  REMINDER_24H_MS,
  REMINDER_2H_MS,
} from '../notification.constants.js';
import { notificationRepository } from '../notification.repository.js';
import { notificationTemplateService } from './notificationTemplate.service.js';

export const toPublicNotification = (n) => ({
  id: String(n._id),
  appointmentId: String(n.appointmentId),
  eventType: n.eventType,
  channel: n.channel,
  title: n.title ?? null,
  messageBody: n.messageBody ?? null,
  status: n.status,
  scheduledAt: n.scheduledAt,
  sentAt: n.sentAt ?? null,
  readAt: n.readAt ?? null,
  createdAt: n.createdAt,
});

export const listMyInAppNotifications = async (user, query) => {
  const result = await notificationRepository.listInAppForUser(user._id, query);
  return {
    notifications: result.items.map(toPublicNotification),
    unreadCount: result.unreadCount,
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / result.limit) || 0,
    },
  };
};

export const markNotificationAsRead = async (user, id) => {
  const updated = await notificationRepository.markAsRead(id, user._id, new Date());
  if (!updated) throw new ApiError(404, 'Notification not found', 'NOTIFICATION_NOT_FOUND');
  return toPublicNotification(updated);
};

export const markAllNotificationsAsRead = async (user) => {
  await notificationRepository.markAllAsRead(user._id, new Date());
  return { markedAllRead: true };
};

const createIdempotentNotification = async (data) => {
  const existing = await notificationRepository.findByIdempotencyKey(data.idempotencyKey);
  if (existing) return existing;
  try {
    return await notificationRepository.create(data);
  } catch (err) {
    if (err?.code === 11000) {
      return notificationRepository.findByIdempotencyKey(data.idempotencyKey);
    }
    throw err;
  }
};

const scheduleForRecipient = async ({
  user,
  recipientRole,
  appointment,
  eventType,
  scheduledAt,
  context,
}) => {
  if (!user) return;
  const pref = await notificationRepository.findPreferenceByUserId(user._id);
  const phone = pref?.phoneNumber ?? user.phoneNumber;
  const inAppEnabled = pref?.inApp?.enabled ?? true;
  const smsAllowed = Boolean(pref?.sms?.enabled && pref?.sms?.optedIn && phone);
  const waAllowed = Boolean(pref?.whatsapp?.enabled && pref?.whatsapp?.optedIn && phone);

  const inApp = notificationTemplateService.renderInApp(eventType, context);
  const baseKey = `${appointment._id}:${user._id}:${eventType}`;

  if (inAppEnabled) {
    const isDueNow = scheduledAt <= new Date();
    await createIdempotentNotification({
      userId: user._id,
      appointmentId: appointment._id,
      idempotencyKey: `${baseKey}:IN_APP`,
      eventType,
      channel: NOTIFICATION_CHANNELS.IN_APP,
      provider: NOTIFICATION_PROVIDERS.INTERNAL,
      templateKey: eventType,
      title: inApp.title,
      messageBody: inApp.messageBody,
      status: isDueNow ? NOTIFICATION_STATUS.SENT : NOTIFICATION_STATUS.SCHEDULED,
      scheduledAt,
      sentAt: isDueNow ? new Date() : null,
    });
  }

  if (smsAllowed) {
    await createIdempotentNotification({
      userId: user._id,
      appointmentId: appointment._id,
      idempotencyKey: `${baseKey}:SMS`,
      eventType,
      channel: NOTIFICATION_CHANNELS.SMS,
      provider: NOTIFICATION_PROVIDERS.TWILIO,
      recipient: phone,
      templateKey: eventType,
      messageBody: notificationTemplateService.renderSms(eventType, context),
      status: NOTIFICATION_STATUS.SCHEDULED,
      scheduledAt,
    });
  }

  if (waAllowed) {
    const wa = notificationTemplateService.renderWhatsApp(eventType, context);
    await createIdempotentNotification({
      userId: user._id,
      appointmentId: appointment._id,
      idempotencyKey: `${baseKey}:WHATSAPP`,
      eventType,
      channel: NOTIFICATION_CHANNELS.WHATSAPP,
      provider: NOTIFICATION_PROVIDERS.TWILIO,
      recipient: phone,
      templateKey: eventType,
      contentSid: wa.contentSid,
      contentVariables: wa.contentVariables,
      status: NOTIFICATION_STATUS.SCHEDULED,
      scheduledAt,
    });
  }
};

export const emitAppointmentNotificationEvent = async ({ appointment, eventType, oldAppointmentId = null }) => {
  try {
    if (!appointment) return;

    if (eventType === NOTIFICATION_EVENT_TYPES.APPOINTMENT_CANCELLED) {
      await notificationRepository.cancelPendingRemindersForAppointment(appointment._id);
    }
    if (eventType === NOTIFICATION_EVENT_TYPES.APPOINTMENT_RESCHEDULED && oldAppointmentId) {
      await notificationRepository.cancelPendingRemindersForAppointment(oldAppointmentId);
    }

    const [patientUser, doctorProfile, clinic] = await Promise.all([
      userRepository.findById ? userRepository.findById(appointment.patientId) : null,
      doctorRepository.findById(appointment.doctorId),
      appointment.clinicId ? clinicRepository.findById(appointment.clinicId) : null,
    ]);

    const doctorUser =
      doctorProfile?.userId && userRepository.findById
        ? await userRepository.findById(doctorProfile.userId)
        : null;

    const clinicName = clinic?.clinicName ?? doctorProfile?.clinicDetails?.clinicName ?? '';
    const now = new Date();

    const patientCtx = notificationTemplateService.buildContext({
      appointment,
      patientUser,
      doctorProfile,
      clinicName,
      recipientRole: 'PATIENT',
    });
    const doctorCtx = notificationTemplateService.buildContext({
      appointment,
      patientUser,
      doctorProfile,
      clinicName,
      recipientRole: 'DOCTOR',
    });

    await scheduleForRecipient({
      user: patientUser,
      recipientRole: 'PATIENT',
      appointment,
      eventType,
      scheduledAt: now,
      context: patientCtx,
    });

    await scheduleForRecipient({
      user: doctorUser,
      recipientRole: 'DOCTOR',
      appointment,
      eventType,
      scheduledAt: now,
      context: doctorCtx,
    });

    // Schedule 24h and 2h reminders for confirmed/rescheduled appointments when in the future.
    if (
      (eventType === NOTIFICATION_EVENT_TYPES.APPOINTMENT_CONFIRMED ||
        eventType === NOTIFICATION_EVENT_TYPES.APPOINTMENT_RESCHEDULED) &&
      appointment.status === APPOINTMENT_STATUS.CONFIRMED
    ) {
      const startMs = new Date(appointment.startAt).getTime();
      const reminders = [
        { type: NOTIFICATION_EVENT_TYPES.APPOINTMENT_REMINDER_24H, at: new Date(startMs - REMINDER_24H_MS) },
        { type: NOTIFICATION_EVENT_TYPES.APPOINTMENT_REMINDER_2H, at: new Date(startMs - REMINDER_2H_MS) },
      ];

      for (const rem of reminders) {
        if (rem.at.getTime() <= Date.now()) continue;
        await scheduleForRecipient({
          user: patientUser,
          recipientRole: 'PATIENT',
          appointment,
          eventType: rem.type,
          scheduledAt: rem.at,
          context: patientCtx,
        });
        await scheduleForRecipient({
          user: doctorUser,
          recipientRole: 'DOCTOR',
          appointment,
          eventType: rem.type,
          scheduledAt: rem.at,
          context: doctorCtx,
        });
      }
    }
  } catch (err) {
    // Notification failures must never break appointment booking/cancellation responses.
    console.error('[notifications] Failed to enqueue appointment notification:', err?.message);
  }
};
