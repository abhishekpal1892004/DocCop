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

export const createFakeDoctorApplicationRepository = () => {
  const store = new Map();
  const repo = {
    findById: async (id) => {
      for (const doc of store.values()) {
        if (String(doc._id) === String(id)) return structuredClone(doc);
      }
      return null;
    },
    findByUserId: async (userId) => (store.has(String(userId)) ? structuredClone(store.get(String(userId))) : null),
    create: async (data) => {
      const key = String(data.userId);
      if (store.has(key)) throw Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
      const doc = { _id: randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...structuredClone(data) };
      store.set(key, doc);
      return structuredClone(doc);
    },
    update: async (userId, set, allowedStatuses) => {
      const doc = store.get(String(userId));
      if (!doc || !allowedStatuses.includes(doc.applicationStatus)) return null;
      applyDotSet(doc, set);
      doc.updatedAt = new Date();
      return structuredClone(doc);
    },
    listForReview: async ({ status, state, q, nmcVerificationStatus, page = 1, limit = 20 }) => {
      let items = [...store.values()];
      if (status) items = items.filter((d) => d.applicationStatus === status);
      if (state) items = items.filter((d) => d.medicalRegistration?.stateCode === state.toUpperCase());
      if (nmcVerificationStatus) items = items.filter((d) => d.nmcVerificationStatus === nmcVerificationStatus);
      if (q) {
        const rx = new RegExp(q, 'i');
        items = items.filter(
          (d) =>
            rx.test(d.personalDetails?.fullName ?? '') ||
            rx.test(d.medicalRegistration?.registrationNumber ?? '') ||
            rx.test(d.clinicDetails?.clinicName ?? '')
        );
      }
      const total = items.length;
      const start = (page - 1) * limit;
      return { items: items.slice(start, start + limit).map((d) => structuredClone(d)), total, page, limit };
    },
    reviewTransition: async (applicationId, allowedStatuses, set) => {
      for (const doc of store.values()) {
        if (String(doc._id) === String(applicationId)) {
          if (!allowedStatuses.includes(doc.applicationStatus)) return null;
          applyDotSet(doc, set);
          doc.updatedAt = new Date();
          return structuredClone(doc);
        }
      }
      return null;
    },
    countByStatuses: async (statuses) =>
      [...store.values()].filter((d) => statuses.includes(d.applicationStatus)).length,
  };
  return { repo, store };
};

export const createFakeNmcLookupRepository = () => {
  const records = [];
  const repo = {
    create: async (data) => {
      const doc = { _id: randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...structuredClone(data) };
      records.push(doc);
      return structuredClone(doc);
    },
    supersedeForApplication: async (applicationId, at) => {
      for (const r of records) {
        if (String(r.applicationId) === String(applicationId) && !r.supersededAt) r.supersededAt = at;
      }
    },
    countSince: async (applicationId, since) =>
      records.filter((r) => String(r.applicationId) === String(applicationId) && r.checkedAt >= since).length,
    findByApplicationId: async (applicationId) =>
      records
        .filter((r) => String(r.applicationId) === String(applicationId))
        .sort((a, b) => b.checkedAt - a.checkedAt)
        .slice(0, 10)
        .map((r) => structuredClone(r)),
  };
  return { repo, records };
};

export const createFakeDoctorRepository = () => {
  const store = new Map();
  const repo = {
    findById: async (id) => {
      for (const doc of store.values()) {
        if (String(doc._id) === String(id)) return structuredClone(doc);
      }
      return null;
    },
    findByUserId: async (userId) => (store.has(String(userId)) ? structuredClone(store.get(String(userId))) : null),
    upsertFromApplication: async (application, approvedBy, approvedAt, { primaryClinicId = null, clinicIds = [] } = {}) => {
      const key = String(application.userId);
      const existing = store.get(key);
      const doc = {
        _id: existing?._id ?? randomUUID(),
        createdAt: existing?.createdAt ?? new Date(),
        updatedAt: new Date(),
        userId: application.userId,
        applicationId: application._id,
        personalDetails: structuredClone(application.personalDetails ?? {}),
        professionalDetails: structuredClone(application.professionalDetails ?? {}),
        medicalRegistration: structuredClone(application.medicalRegistration ?? {}),
        clinicDetails: structuredClone(application.clinicDetails ?? {}),
        primaryClinicId,
        clinicIds,
        professionalVerificationStatus: 'VERIFIED',
        profileStatus: 'PUBLISHED',
        consultationFee: existing?.consultationFee ?? null,
        bio: existing?.bio ?? null,
        languages: existing?.languages ?? [],
        isAcceptingPatients: existing?.isAcceptingPatients ?? true,
        isVerified: true,
        approvedAt,
        approvedBy,
      };
      store.set(key, doc);
      return structuredClone(doc);
    },
    updatePracticeProfile: async (userId, set) => {
      const doc = store.get(String(userId));
      if (!doc) return null;
      applyDotSet(doc, set);
      doc.updatedAt = new Date();
      return structuredClone(doc);
    },
    updateProfileStatus: async (id, set) => {
      for (const doc of store.values()) {
        if (String(doc._id) === String(id)) {
          applyDotSet(doc, set);
          doc.updatedAt = new Date();
          return structuredClone(doc);
        }
      }
      return null;
    },
    countByProfileStatus: async (profileStatus) =>
      [...store.values()].filter((d) => !profileStatus || d.profileStatus === profileStatus).length,
    listForAdmin: async ({ profileStatus, q, page = 1, limit = 20 }) => {
      let items = [...store.values()];
      if (profileStatus) items = items.filter((d) => d.profileStatus === profileStatus);
      if (q) {
        const rx = new RegExp(q, 'i');
        items = items.filter((d) => rx.test(d.personalDetails?.fullName ?? ''));
      }
      const total = items.length;
      const start = (page - 1) * limit;
      return { items: items.slice(start, start + limit).map((d) => structuredClone(d)), total, page, limit };
    },
    search: async ({ specialization, city, state, medicalSystem, q, acceptingOnly = true, page = 1, limit = 20 }) => {
      let items = [...store.values()].filter((d) => d.isVerified && d.profileStatus === 'PUBLISHED');
      if (acceptingOnly) items = items.filter((d) => d.isAcceptingPatients);
      if (specialization) {
        const rx = new RegExp(specialization, 'i');
        items = items.filter((d) => rx.test(d.professionalDetails?.specialization ?? ''));
      }
      if (city) {
        const rx = new RegExp(`^${city}$`, 'i');
        items = items.filter((d) => rx.test(d.clinicDetails?.address?.city ?? ''));
      }
      if (state) {
        const rx = new RegExp(`^${state}$`, 'i');
        items = items.filter((d) => rx.test(d.clinicDetails?.address?.state ?? ''));
      }
      if (medicalSystem) items = items.filter((d) => d.professionalDetails?.medicalSystem === medicalSystem);
      if (q) {
        const rx = new RegExp(q, 'i');
        items = items.filter(
          (d) =>
            rx.test(d.personalDetails?.fullName ?? '') ||
            rx.test(d.professionalDetails?.specialization ?? '') ||
            rx.test(d.clinicDetails?.clinicName ?? '') ||
            rx.test(d.clinicDetails?.address?.city ?? '')
        );
      }
      const total = items.length;
      const start = (page - 1) * limit;
      return { items: items.slice(start, start + limit).map((d) => structuredClone(d)), total, page, limit };
    },
  };
  return { repo, store };
};
