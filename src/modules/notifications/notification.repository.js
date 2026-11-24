import { Notification } from './models/notification.model.js';
import { NotificationPreference } from './models/notificationPreference.model.js';
import { NOTIFICATION_CHANNELS, NOTIFICATION_STATUS } from './notification.constants.js';

export const notificationRepository = {
  async create(data) {
    const doc = await Notification.create(data);
    return doc.toObject();
  },

  findById: (id) => Notification.findById(id).lean(),

  findByIdempotencyKey: (idempotencyKey) => Notification.findOne({ idempotencyKey }).lean(),

  findByProviderMessageSid: (providerMessageSid) => Notification.findOne({ providerMessageSid }).lean(),

  async listInAppForUser(userId, { unreadOnly = false, page = 1, limit = 20 }) {
    const now = new Date();
    const filter = {
      userId,
      channel: NOTIFICATION_CHANNELS.IN_APP,
      status: { $ne: NOTIFICATION_STATUS.CANCELLED },
      scheduledAt: { $lte: now },
    };
    if (unreadOnly) filter.readAt = null;
    const skip = (page - 1) * limit;
    const [items, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({
        userId,
        channel: NOTIFICATION_CHANNELS.IN_APP,
        status: { $ne: NOTIFICATION_STATUS.CANCELLED },
        scheduledAt: { $lte: now },
        readAt: null,
      }),
    ]);
    return { items, total, unreadCount, page, limit };
  },

  markAsRead: (id, userId, at = new Date()) =>
    Notification.findOneAndUpdate(
      { _id: id, userId, channel: NOTIFICATION_CHANNELS.IN_APP },
      { $set: { readAt: at, status: NOTIFICATION_STATUS.READ } },
      { new: true }
    ).lean(),

  markAllAsRead: (userId, at = new Date()) =>
    Notification.updateMany(
      {
        userId,
        channel: NOTIFICATION_CHANNELS.IN_APP,
        status: NOTIFICATION_STATUS.SENT,
        scheduledAt: { $lte: at },
        readAt: null,
      },
      { $set: { readAt: at, status: NOTIFICATION_STATUS.READ } }
    ),

  cancelPendingRemindersForAppointment: (appointmentId) =>
    Notification.updateMany(
      {
        appointmentId,
        status: { $in: [NOTIFICATION_STATUS.SCHEDULED, NOTIFICATION_STATUS.QUEUED] },
      },
      { $set: { status: NOTIFICATION_STATUS.CANCELLED, lockUntil: null } }
    ),

  /**
   * Atomically claim one due external notification using a time-limited lease (`lockUntil`).
   * Prevents two workers from claiming the same job simultaneously.
   */
  claimNextDueJob: (now = new Date(), leaseUntil) =>
    Notification.findOneAndUpdate(
      {
        channel: { $in: [NOTIFICATION_CHANNELS.SMS, NOTIFICATION_CHANNELS.WHATSAPP] },
        $and: [
          { $or: [{ providerMessageSid: { $exists: false } }, { providerMessageSid: null }] },
          {
            $or: [
              {
                status: { $in: [NOTIFICATION_STATUS.SCHEDULED, NOTIFICATION_STATUS.QUEUED] },
                scheduledAt: { $lte: now },
                $or: [{ nextAttemptAt: null }, { nextAttemptAt: { $lte: now } }],
              },
              {
                // Recover expired processing leases.
                status: NOTIFICATION_STATUS.PROCESSING,
                lockUntil: { $lt: now },
              },
            ],
          },
        ],
      },
      {
        $set: { status: NOTIFICATION_STATUS.PROCESSING, lockUntil: leaseUntil },
        $inc: { attemptCount: 1 },
      },
      { new: true, sort: { scheduledAt: 1, _id: 1 } }
    ).lean(),

  updateById: (id, set) =>
    Notification.findByIdAndUpdate(id, { $set: set }, { new: true, runValidators: true }).lean(),

  // Preferences
  findPreferenceByUserId: (userId) => NotificationPreference.findOne({ userId }).lean(),

  upsertPreference: (userId, set) =>
    NotificationPreference.findOneAndUpdate(
      { userId },
      { $set: set },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean(),
};
