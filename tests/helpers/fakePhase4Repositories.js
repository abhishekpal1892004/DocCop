import { randomUUID } from 'node:crypto';

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

export const createFakeDoctorVerificationRepository = () => {
  const store = new Map();
  const repo = {
    findByApplicationId: async (applicationId) =>
      store.has(String(applicationId)) ? structuredClone(store.get(String(applicationId))) : null,
    findByUserId: async (userId) => {
      for (const doc of store.values()) {
        if (String(doc.userId) === String(userId)) return structuredClone(doc);
      }
      return null;
    },
    upsertInitial: async (applicationId, userId, initial) => {
      const key = String(applicationId);
      if (store.has(key)) return structuredClone(store.get(key));
      const doc = {
        _id: randomUUID(),
        applicationId,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...structuredClone(initial),
      };
      store.set(key, doc);
      return structuredClone(doc);
    },
    updateTrack: async (applicationId, set) => {
      const doc = store.get(String(applicationId));
      if (!doc) return null;
      applyDotSet(doc, set);
      doc.updatedAt = new Date();
      return structuredClone(doc);
    },
  };
  return { repo, store };
};

export const createFakeClinicRepository = () => {
  const clinics = new Map();
  const associations = new Map();
  const repo = {
    findById: async (id) => (clinics.has(String(id)) ? structuredClone(clinics.get(String(id))) : null),
    create: async (data) => {
      const doc = { _id: randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...structuredClone(data) };
      clinics.set(String(doc._id), doc);
      return structuredClone(doc);
    },
    findMatchingClinic: async ({ clinicName, city, registrationNumber }) => {
      for (const c of clinics.values()) {
        if (registrationNumber && c.registrationNumber === registrationNumber) return structuredClone(c);
        if (
          !registrationNumber &&
          c.clinicName?.toLowerCase() === clinicName?.toLowerCase() &&
          (!city || c.address?.city?.toLowerCase() === city.toLowerCase())
        ) {
          return structuredClone(c);
        }
      }
      return null;
    },
    list: async ({ verificationStatus, city, state, q, page = 1, limit = 20 }) => {
      let items = [...clinics.values()];
      if (verificationStatus) items = items.filter((c) => c.verificationStatus === verificationStatus);
      if (city) items = items.filter((c) => c.address?.city?.toLowerCase() === city.toLowerCase());
      if (state) items = items.filter((c) => c.address?.state?.toLowerCase() === state.toLowerCase());
      if (q) {
        const rx = new RegExp(q, 'i');
        items = items.filter((c) => rx.test(c.clinicName ?? '') || rx.test(c.registrationNumber ?? ''));
      }
      const total = items.length;
      const start = (page - 1) * limit;
      return { items: items.slice(start, start + limit).map((c) => structuredClone(c)), total, page, limit };
    },
    updateVerification: async (id, set) => {
      const doc = clinics.get(String(id));
      if (!doc) return null;
      Object.assign(doc, set, { updatedAt: new Date() });
      return structuredClone(doc);
    },
    countAll: async () => clinics.size,
    countByStatus: async (status) => [...clinics.values()].filter((c) => c.verificationStatus === status).length,

    upsertAssociation: async ({ doctorUserId, clinicId, applicationId, doctorProfileId, relationshipType, affiliationDocumentId, verificationStatus }) => {
      const key = `${doctorUserId}:${clinicId}`;
      const existing = associations.get(key);
      const doc = {
        _id: existing?._id ?? randomUUID(),
        createdAt: existing?.createdAt ?? new Date(),
        updatedAt: new Date(),
        doctorUserId,
        clinicId,
        applicationId: applicationId ?? existing?.applicationId ?? null,
        doctorProfileId: doctorProfileId ?? existing?.doctorProfileId ?? null,
        relationshipType,
        affiliationDocumentId: affiliationDocumentId ?? existing?.affiliationDocumentId,
        verificationStatus: verificationStatus ?? existing?.verificationStatus ?? 'PENDING',
      };
      associations.set(key, doc);
      return structuredClone(doc);
    },
    findAssociationById: async (id) => {
      for (const a of associations.values()) {
        if (String(a._id) === String(id)) return structuredClone(a);
      }
      return null;
    },
    findAssociationsByDoctorUserId: async (doctorUserId) =>
      [...associations.values()].filter((a) => String(a.doctorUserId) === String(doctorUserId)).map((a) => structuredClone(a)),
    findAssociationsByClinicId: async (clinicId) =>
      [...associations.values()].filter((a) => String(a.clinicId) === String(clinicId)).map((a) => structuredClone(a)),
    updateAssociationVerification: async (id, set) => {
      for (const a of associations.values()) {
        if (String(a._id) === String(id)) {
          Object.assign(a, set, { updatedAt: new Date() });
          return structuredClone(a);
        }
      }
      return null;
    },
    linkDoctorProfileToAssociations: async (doctorUserId, doctorProfileId) => {
      for (const a of associations.values()) {
        if (String(a.doctorUserId) === String(doctorUserId)) a.doctorProfileId = doctorProfileId;
      }
    },
  };
  return { repo, clinics, associations };
};

export const createFakeAuditLogRepository = () => {
  const logs = [];
  const repo = {
    create: async (data) => {
      const doc = { _id: randomUUID(), createdAt: new Date(), ...structuredClone(data) };
      logs.push(doc);
      return structuredClone(doc);
    },
    list: async ({ targetType, targetId, action, actorUserId, page = 1, limit = 20 }) => {
      let items = [...logs].reverse();
      if (targetType) items = items.filter((l) => l.targetType === targetType);
      if (targetId) items = items.filter((l) => String(l.targetId) === String(targetId));
      if (action) items = items.filter((l) => l.action === action);
      if (actorUserId) items = items.filter((l) => String(l.actorUserId) === String(actorUserId));
      const total = items.length;
      const start = (page - 1) * limit;
      return { items: items.slice(start, start + limit).map((l) => structuredClone(l)), total, page, limit };
    },
  };
  return { repo, logs };
};
