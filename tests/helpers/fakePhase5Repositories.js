import { randomUUID } from 'node:crypto';

export const createFakeCalendlyRepository = () => {
  const oauthStates = new Map();
  const connections = new Map();
  const appointmentTypes = new Map();

  const repo = {
    createOAuthState: async (data) => {
      const doc = { _id: randomUUID(), createdAt: new Date(), ...structuredClone(data) };
      oauthStates.set(doc.state, doc);
      return structuredClone(doc);
    },
    consumeOAuthState: async (state, now = new Date()) => {
      const doc = oauthStates.get(state);
      if (!doc || doc.consumedAt || new Date(doc.expiresAt) <= now) return null;
      doc.consumedAt = now;
      return structuredClone(doc);
    },
    findConnectionByDoctorId: async (doctorId) =>
      connections.has(String(doctorId)) ? structuredClone(connections.get(String(doctorId))) : null,
    findConnectionByUserUri: async (uri) => {
      for (const c of connections.values()) {
        if (c.calendlyUserUri === uri) return structuredClone(c);
      }
      return null;
    },
    upsertConnection: async (doctorId, data) => {
      const key = String(doctorId);
      const existing = connections.get(key);
      const doc = {
        _id: existing?._id ?? randomUUID(),
        createdAt: existing?.createdAt ?? new Date(),
        updatedAt: new Date(),
        ...existing,
        ...structuredClone(data),
      };
      connections.set(key, doc);
      return structuredClone(doc);
    },
    updateConnectionByDoctorId: async (doctorId, set) => {
      const doc = connections.get(String(doctorId));
      if (!doc) return null;
      Object.assign(doc, set, { updatedAt: new Date() });
      return structuredClone(doc);
    },
    findAppointmentTypeById: async (id) =>
      appointmentTypes.has(String(id)) ? structuredClone(appointmentTypes.get(String(id))) : null,
    findAppointmentTypesByDoctorId: async (doctorId, { activeOnly = false } = {}) => {
      let items = [...appointmentTypes.values()].filter((a) => String(a.doctorId) === String(doctorId));
      if (activeOnly) items = items.filter((a) => a.isActive);
      return items.map((a) => structuredClone(a));
    },
    upsertAppointmentType: async (doctorId, uri, data) => {
      for (const a of appointmentTypes.values()) {
        if (String(a.doctorId) === String(doctorId) && a.calendlyEventTypeUri === uri) {
          Object.assign(a, structuredClone(data), { updatedAt: new Date() });
          return structuredClone(a);
        }
      }
      const doc = { _id: randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...structuredClone(data) };
      appointmentTypes.set(String(doc._id), doc);
      return structuredClone(doc);
    },
    updateAppointmentTypeById: async (id, doctorId, set) => {
      const doc = appointmentTypes.get(String(id));
      if (!doc || String(doc.doctorId) !== String(doctorId)) return null;
      Object.assign(doc, set, { updatedAt: new Date() });
      return structuredClone(doc);
    },
  };
  return { repo, oauthStates, connections, appointmentTypes };
};

export const createFakeAppointmentRepository = () => {
  const appointments = new Map();
  const attempts = new Map();

  const matchesFilter = (doc, filter) => {
    if (filter.patientId && String(doc.patientId) !== String(filter.patientId)) return false;
    if (filter.doctorId && String(doc.doctorId) !== String(filter.doctorId)) return false;
    if (filter.status) {
      if (typeof filter.status === 'string' && doc.status !== filter.status) return false;
      if (filter.status.$in && !filter.status.$in.includes(doc.status)) return false;
    }
    if (filter.startAt) {
      const t = new Date(doc.startAt).getTime();
      if (filter.startAt.$gte && t < new Date(filter.startAt.$gte).getTime()) return false;
      if (filter.startAt.$lt && t >= new Date(filter.startAt.$lt).getTime()) return false;
      if (filter.startAt.$lte && t > new Date(filter.startAt.$lte).getTime()) return false;
    }
    return true;
  };

  const repo = {
    findById: async (id) => (appointments.has(String(id)) ? structuredClone(appointments.get(String(id))) : null),
    findByInviteeUri: async (uri) => {
      for (const a of appointments.values()) {
        if (a.calendlyInviteeUri === uri) return structuredClone(a);
      }
      return null;
    },
    findByEventUri: async (uri) => {
      for (const a of appointments.values()) {
        if (a.calendlyEventUri === uri) return structuredClone(a);
      }
      return null;
    },
    create: async (data) => {
      const doc = { _id: randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...structuredClone(data) };
      appointments.set(String(doc._id), doc);
      return structuredClone(doc);
    },
    updateById: async (id, set) => {
      const doc = appointments.get(String(id));
      if (!doc) return null;
      Object.assign(doc, set, { updatedAt: new Date() });
      return structuredClone(doc);
    },
    upsertByInviteeUri: async (uri, data) => {
      for (const a of appointments.values()) {
        if (a.calendlyInviteeUri === uri) {
          Object.assign(a, structuredClone(data), { updatedAt: new Date() });
          return structuredClone(a);
        }
      }
      const doc = { _id: randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...structuredClone(data) };
      appointments.set(String(doc._id), doc);
      return structuredClone(doc);
    },
    list: async (filter, { sortDir = -1, page = 1, limit = 20 }) => {
      const items = [...appointments.values()]
        .filter((d) => matchesFilter(d, filter))
        .sort((a, b) => sortDir * (new Date(a.startAt) - new Date(b.startAt)));
      const total = items.length;
      const start = (page - 1) * limit;
      return { items: items.slice(start, start + limit).map((d) => structuredClone(d)), total, page, limit };
    },
    findAttemptByKey: async (patientId, key) => {
      const k = `${patientId}:${key}`;
      return attempts.has(k) ? structuredClone(attempts.get(k)) : null;
    },
    createAttempt: async (data) => {
      const k = `${data.patientId}:${data.idempotencyKey}`;
      if (attempts.has(k)) throw Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
      const doc = { _id: randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...structuredClone(data) };
      attempts.set(k, doc);
      return structuredClone(doc);
    },
    updateAttemptById: async (id, set) => {
      for (const a of attempts.values()) {
        if (String(a._id) === String(id)) {
          Object.assign(a, set, { updatedAt: new Date() });
          return structuredClone(a);
        }
      }
      return null;
    },
  };
  return { repo, appointments, attempts };
};

export const createFakeCalendlyWebhookRepository = () => {
  const store = new Map();
  const repo = {
    findByDedupKey: async (key) => (store.has(key) ? structuredClone(store.get(key)) : null),
    create: async (data) => {
      if (store.has(data.dedupKey)) throw Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
      const doc = { _id: randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...structuredClone(data) };
      store.set(data.dedupKey, doc);
      return structuredClone(doc);
    },
    updateById: async (id, set) => {
      for (const w of store.values()) {
        if (String(w._id) === String(id)) {
          Object.assign(w, set, { updatedAt: new Date() });
          return structuredClone(w);
        }
      }
      return null;
    },
  };
  return { repo, store };
};
