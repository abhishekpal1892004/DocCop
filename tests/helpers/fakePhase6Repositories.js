import { randomUUID } from 'node:crypto';
import { NOTIFICATION_CHANNELS, NOTIFICATION_STATUS } from '../../src/modules/notifications/notification.constants.js';

const applyDotSet = (doc, set) => {
  for (const [k, v] of Object.entries(set)) {
    const parts = k.split('.');
    let cur = doc;
    for (let i = 0; i < parts.length - 1; i += 1) {
      cur[parts[i]] = { ...(cur[parts[i]] ?? {}) };
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = v;
  }
};

export const createFakeNotificationRepository = () => {
  const notifications = new Map();
  const preferences = new Map();

  const repo = {
    create: async (data) => {
      for (const n of notifications.values()) {
        if (n.idempotencyKey === data.idempotencyKey) {
          throw Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
        }
      }
      const doc = { _id: randomUUID(), createdAt: new Date(), updatedAt: new Date(), attemptCount: 0, maxAttempts: 3, ...structuredClone(data) };
      notifications.set(String(doc._id), doc);
      return structuredClone(doc);
    },
    findById: async (id) => (notifications.has(String(id)) ? structuredClone(notifications.get(String(id))) : null),
    findByIdempotencyKey: async (key) => {
      for (const n of notifications.values()) {
        if (n.idempotencyKey === key) return structuredClone(n);
      }
      return null;
    },
    findByProviderMessageSid: async (sid) => {
      for (const n of notifications.values()) {
        if (n.providerMessageSid === sid) return structuredClone(n);
      }
      return null;
    },
    listInAppForUser: async (userId, { unreadOnly = false, page = 1, limit = 20 }) => {
      const now = new Date();
      const all = [...notifications.values()]
        .filter(
          (n) =>
            String(n.userId) === String(userId) &&
            n.channel === NOTIFICATION_CHANNELS.IN_APP &&
            n.status !== NOTIFICATION_STATUS.CANCELLED &&
            new Date(n.scheduledAt) <= now
        )
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const unreadCount = all.filter((n) => !n.readAt).length;
      const filtered = unreadOnly ? all.filter((n) => !n.readAt) : all;
      const total = filtered.length;
      const start = (page - 1) * limit;
      return { items: filtered.slice(start, start + limit).map((n) => structuredClone(n)), total, unreadCount, page, limit };
    },
    markAsRead: async (id, userId, at = new Date()) => {
      const doc = notifications.get(String(id));
      if (!doc || String(doc.userId) !== String(userId) || doc.channel !== NOTIFICATION_CHANNELS.IN_APP) return null;
      doc.readAt = at;
      doc.status = NOTIFICATION_STATUS.READ;
      return structuredClone(doc);
    },
    markAllAsRead: async (userId, at = new Date()) => {
      for (const n of notifications.values()) {
        if (
          String(n.userId) === String(userId) &&
          n.channel === NOTIFICATION_CHANNELS.IN_APP &&
          n.status === NOTIFICATION_STATUS.SENT &&
          new Date(n.scheduledAt) <= at &&
          !n.readAt
        ) {
          n.readAt = at;
          n.status = NOTIFICATION_STATUS.READ;
        }
      }
    },
    cancelPendingRemindersForAppointment: async (appointmentId) => {
      for (const n of notifications.values()) {
        if (
          String(n.appointmentId) === String(appointmentId) &&
          (n.status === NOTIFICATION_STATUS.SCHEDULED || n.status === NOTIFICATION_STATUS.QUEUED)
        ) {
          n.status = NOTIFICATION_STATUS.CANCELLED;
          n.lockUntil = null;
        }
      }
    },
    claimNextDueJob: async (now = new Date(), leaseUntil) => {
      const due = [...notifications.values()]
        .filter((n) => {
          if (n.channel !== NOTIFICATION_CHANNELS.SMS && n.channel !== NOTIFICATION_CHANNELS.WHATSAPP) return false;
          if (n.providerMessageSid) return false;
          const isDue =
            (n.status === NOTIFICATION_STATUS.SCHEDULED || n.status === NOTIFICATION_STATUS.QUEUED) &&
            new Date(n.scheduledAt) <= now &&
            (!n.nextAttemptAt || new Date(n.nextAttemptAt) <= now);
          const isExpiredLease =
            n.status === NOTIFICATION_STATUS.PROCESSING && n.lockUntil && new Date(n.lockUntil) < now;
          return isDue || isExpiredLease;
        })
        .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));

      const job = due[0];
      if (!job) return null;
      job.status = NOTIFICATION_STATUS.PROCESSING;
      job.lockUntil = leaseUntil;
      job.attemptCount = (job.attemptCount ?? 0) + 1;
      return structuredClone(job);
    },
    updateById: async (id, set) => {
      const doc = notifications.get(String(id));
      if (!doc) return null;
      Object.assign(doc, set, { updatedAt: new Date() });
      return structuredClone(doc);
    },
    findPreferenceByUserId: async (userId) =>
      preferences.has(String(userId)) ? structuredClone(preferences.get(String(userId))) : null,
    upsertPreference: async (userId, set) => {
      const key = String(userId);
      const doc = preferences.get(key) ?? {
        _id: randomUUID(),
        userId,
        preferredChannel: 'SMS',
        sms: { enabled: false, optedIn: false },
        whatsapp: { enabled: false, optedIn: false },
        inApp: { enabled: true },
        createdAt: new Date(),
      };
      applyDotSet(doc, set);
      doc.updatedAt = new Date();
      preferences.set(key, doc);
      return structuredClone(doc);
    },
  };

  return { repo, notifications, preferences };
};
