import { mapTwilioStatus, shouldAdvanceStatus } from '../../../integrations/twilio/twilio.webhook.service.js';
import { NOTIFICATION_STATUS } from '../notification.constants.js';
import { notificationRepository } from '../notification.repository.js';

export const processTwilioStatusCallback = async ({ MessageSid, MessageStatus, ErrorCode }) => {
  if (!MessageSid || !MessageStatus) {
    return { updated: false, reason: 'Missing MessageSid or MessageStatus' };
  }

  const notification = await notificationRepository.findByProviderMessageSid(MessageSid);
  if (!notification) {
    return { updated: false, reason: 'Notification not found for MessageSid' };
  }

  const nextStatus = mapTwilioStatus(MessageStatus);
  if (!shouldAdvanceStatus(notification.status, nextStatus)) {
    return {
      updated: false,
      reason: `Ignored out-of-order or duplicate status ${nextStatus} (current: ${notification.status})`,
    };
  }

  const now = new Date();
  const set = { status: nextStatus };
  if (nextStatus === NOTIFICATION_STATUS.DELIVERED) set.deliveredAt = now;
  if (nextStatus === NOTIFICATION_STATUS.READ) set.readAt = now;
  if (nextStatus === NOTIFICATION_STATUS.FAILED || nextStatus === NOTIFICATION_STATUS.UNDELIVERED) {
    set.failedAt = now;
    if (ErrorCode) set.lastErrorCode = String(ErrorCode);
  }

  await notificationRepository.updateById(notification._id, set);
  return { updated: true, status: nextStatus };
};
