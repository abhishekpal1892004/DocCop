import { randomUUID } from 'node:crypto';
import { PAYMENT_STATUS } from '../../src/modules/payments/payment.constants.js';

export const createFakePaymentRepository = () => {
  const payments = new Map();
  const webhooks = new Map();

  const repo = {
    create: async (data) => {
      const doc = { _id: randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...structuredClone(data) };
      payments.set(String(doc._id), doc);
      return structuredClone(doc);
    },
    findById: async (id) => (payments.has(String(id)) ? structuredClone(payments.get(String(id))) : null),
    findByOrderId: async (orderId) => {
      for (const p of payments.values()) {
        if (p.razorpayOrderId === orderId) return structuredClone(p);
      }
      return null;
    },
    findByPaymentId: async (payId) => {
      for (const p of payments.values()) {
        if (p.razorpayPaymentId === payId) return structuredClone(p);
      }
      return null;
    },
    findActiveOrderForAppointment: async (appointmentId) => {
      for (const p of payments.values()) {
        if (
          String(p.appointmentId) === String(appointmentId) &&
          [PAYMENT_STATUS.CREATED, PAYMENT_STATUS.PENDING, PAYMENT_STATUS.AUTHORIZED, PAYMENT_STATUS.CAPTURED].includes(
            p.status
          )
        ) {
          return structuredClone(p);
        }
      }
      return null;
    },
    updateById: async (id, set) => {
      const doc = payments.get(String(id));
      if (!doc) return null;
      Object.assign(doc, set, { updatedAt: new Date() });
      return structuredClone(doc);
    },
    listByPatient: async (patientId, { page = 1, limit = 20 }) => {
      const items = [...payments.values()].filter((p) => String(p.patientId) === String(patientId));
      const total = items.length;
      const start = (page - 1) * limit;
      return { items: items.slice(start, start + limit).map((p) => structuredClone(p)), total, page, limit };
    },
    findWebhookByEventId: async (eventId) =>
      webhooks.has(eventId) ? structuredClone(webhooks.get(eventId)) : null,
    createWebhookEvent: async (data) => {
      const doc = { _id: randomUUID(), createdAt: new Date(), ...structuredClone(data) };
      webhooks.set(doc.eventId, doc);
      return structuredClone(doc);
    },
    updateWebhookById: async (id, set) => {
      for (const w of webhooks.values()) {
        if (String(w._id) === String(id)) {
          Object.assign(w, set);
          return structuredClone(w);
        }
      }
      return null;
    },
  };
  return { repo, payments, webhooks };
};

export const createFakeVideoConsultationRepository = () => {
  const store = new Map();
  const repo = {
    findByAppointmentId: async (appointmentId) =>
      store.has(String(appointmentId)) ? structuredClone(store.get(String(appointmentId))) : null,
    upsertForAppointment: async (appointmentId, setOnInsert, set = {}) => {
      const key = String(appointmentId);
      const existing = store.get(key);
      const doc = existing
        ? { ...existing, ...structuredClone(set), updatedAt: new Date() }
        : {
            _id: randomUUID(),
            createdAt: new Date(),
            updatedAt: new Date(),
            ...structuredClone(setOnInsert),
            ...structuredClone(set),
          };
      store.set(key, doc);
      return structuredClone(doc);
    },
    updateByAppointmentId: async (appointmentId, set) => {
      const doc = store.get(String(appointmentId));
      if (!doc) return null;
      Object.assign(doc, set, { updatedAt: new Date() });
      return structuredClone(doc);
    },
  };
  return { repo, store };
};

export const createFakeReviewRepository = () => {
  const store = new Map();
  const repo = {
    create: async (data) => {
      const doc = { _id: randomUUID(), createdAt: new Date(), updatedAt: new Date(), reportedCount: 0, ...structuredClone(data) };
      store.set(String(doc._id), doc);
      return structuredClone(doc);
    },
    findById: async (id) => (store.has(String(id)) ? structuredClone(store.get(String(id))) : null),
    findByPatientAndAppointment: async (patientId, appointmentId) => {
      for (const r of store.values()) {
        if (String(r.patientId) === String(patientId) && String(r.appointmentId) === String(appointmentId)) {
          return structuredClone(r);
        }
      }
      return null;
    },
    updateById: async (id, set) => {
      const doc = store.get(String(id));
      if (!doc) return null;
      Object.assign(doc, set, { updatedAt: new Date() });
      return structuredClone(doc);
    },
    deleteById: async (id) => {
      const doc = store.get(String(id));
      store.delete(String(id));
      return doc ? structuredClone(doc) : null;
    },
    incrementReportCount: async (id) => {
      const doc = store.get(String(id));
      if (!doc) return null;
      doc.reportedCount = (doc.reportedCount ?? 0) + 1;
      doc.moderationStatus = 'FLAGGED';
      return structuredClone(doc);
    },
    listApprovedByDoctor: async (doctorId, { page = 1, limit = 20 }) => {
      const items = [...store.values()].filter(
        (r) => String(r.doctorId) === String(doctorId) && r.moderationStatus === 'APPROVED'
      );
      const total = items.length;
      const start = (page - 1) * limit;
      return { items: items.slice(start, start + limit).map((r) => structuredClone(r)), total, page, limit };
    },
    listByPatient: async (patientId, { page = 1, limit = 20 }) => {
      const items = [...store.values()].filter((r) => String(r.patientId) === String(patientId));
      const total = items.length;
      const start = (page - 1) * limit;
      return { items: items.slice(start, start + limit).map((r) => structuredClone(r)), total, page, limit };
    },
    listForModeration: async ({ moderationStatus, page = 1, limit = 20 }) => {
      let items = [...store.values()];
      if (moderationStatus) items = items.filter((r) => r.moderationStatus === moderationStatus);
      const total = items.length;
      const start = (page - 1) * limit;
      return { items: items.slice(start, start + limit).map((r) => structuredClone(r)), total, page, limit };
    },
    getDoctorRatingSummary: async (doctorId) => {
      const items = [...store.values()].filter(
        (r) => String(r.doctorId) === String(doctorId) && r.moderationStatus === 'APPROVED'
      );
      const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      let sum = 0;
      for (const r of items) {
        dist[r.rating] = (dist[r.rating] ?? 0) + 1;
        sum += r.rating;
      }
      return {
        averageRating: items.length ? Number((sum / items.length).toFixed(2)) : 0,
        totalReviews: items.length,
        distribution: dist,
      };
    },
  };
  return { repo, store };
};

export const createFakeQueueRepository = () => {
  const sessions = new Map();
  const entries = new Map();

  const repo = {
    createSession: async (data) => {
      const doc = {
        _id: randomUUID(),
        currentTokenNumber: 0,
        nextTokenSequence: 0,
        averageConsultationMinutes: 15,
        openedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...structuredClone(data),
      };
      sessions.set(String(doc._id), doc);
      return structuredClone(doc);
    },
    findSessionById: async (id) => (sessions.has(String(id)) ? structuredClone(sessions.get(String(id))) : null),
    findSessionByDoctorAndDate: async (doctorId, dateKey) => {
      for (const s of sessions.values()) {
        if (String(s.doctorId) === String(doctorId) && s.dateKey === dateKey) return structuredClone(s);
      }
      return null;
    },
    updateSessionById: async (id, doctorId, set) => {
      const doc = sessions.get(String(id));
      if (!doc || String(doc.doctorId) !== String(doctorId)) return null;
      Object.assign(doc, set, { updatedAt: new Date() });
      return structuredClone(doc);
    },
    allocateNextToken: async (sessionId) => {
      const doc = sessions.get(String(sessionId));
      if (!doc || doc.status !== 'OPEN') return null;
      doc.nextTokenSequence = (doc.nextTokenSequence ?? 0) + 1;
      return structuredClone(doc);
    },
    createEntry: async (data) => {
      for (const e of entries.values()) {
        if (String(e.appointmentId) === String(data.appointmentId)) {
          throw Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
        }
      }
      const doc = { _id: randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...structuredClone(data) };
      entries.set(String(doc._id), doc);
      return structuredClone(doc);
    },
    findEntryById: async (id) => (entries.has(String(id)) ? structuredClone(entries.get(String(id))) : null),
    findEntryByAppointmentId: async (appointmentId) => {
      for (const e of entries.values()) {
        if (String(e.appointmentId) === String(appointmentId)) return structuredClone(e);
      }
      return null;
    },
    listEntriesForSession: async (queueSessionId) =>
      [...entries.values()]
        .filter((e) => String(e.queueSessionId) === String(queueSessionId))
        .sort((a, b) => a.tokenNumber - b.tokenNumber)
        .map((e) => structuredClone(e)),
    countWaitingAhead: async (queueSessionId, tokenNumber) =>
      [...entries.values()].filter(
        (e) =>
          String(e.queueSessionId) === String(queueSessionId) &&
          e.status === 'WAITING' &&
          e.tokenNumber < tokenNumber
      ).length,
    claimNextWaitingEntry: async (queueSessionId, now = new Date()) => {
      const waiting = [...entries.values()]
        .filter((e) => String(e.queueSessionId) === String(queueSessionId) && e.status === 'WAITING')
        .sort((a, b) => a.tokenNumber - b.tokenNumber);
      const next = waiting[0];
      if (!next) return null;
      next.status = 'CALLED';
      next.calledAt = now;
      return structuredClone(next);
    },
    updateEntryStatus: async (entryId, queueSessionId, allowedStatuses, set) => {
      const doc = entries.get(String(entryId));
      if (!doc || String(doc.queueSessionId) !== String(queueSessionId) || !allowedStatuses.includes(doc.status)) {
        return null;
      }
      Object.assign(doc, set, { updatedAt: new Date() });
      return structuredClone(doc);
    },
  };
  return { repo, sessions, entries };
};
