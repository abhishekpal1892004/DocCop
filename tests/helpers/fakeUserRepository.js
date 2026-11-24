import { randomUUID } from 'node:crypto';

/**
 * In-memory stand-in for userRepository (mirrors its contract, incl. unique clerkUserId).
 * `calls` lets tests assert how many write operations happened.
 */
export const createFakeUserRepository = () => {
  const store = new Map();
  const calls = { create: 0, syncIdentity: 0, markDeleted: 0, updateProfile: 0 };

  const repo = {
    findById: async (userId) => {
      for (const doc of store.values()) {
        if (String(doc._id) === String(userId)) return { ...doc };
      }
      return null;
    },

    findByClerkUserId: async (id) => (store.has(id) ? { ...store.get(id) } : null),

    create: async (data) => {
      calls.create += 1;
      if (store.has(data.clerkUserId)) throw Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
      const doc = { _id: randomUUID(), createdAt: new Date(), ...data, email: data.email.toLowerCase() };
      store.set(doc.clerkUserId, doc);
      return { ...doc };
    },

    updateProfile: async (id, set) => {
      calls.updateProfile += 1;
      const doc = store.get(id);
      if (!doc) return null;
      for (const [k, v] of Object.entries(set)) {
        if (k.startsWith('preferences.')) doc.preferences = { ...doc.preferences, [k.split('.')[1]]: v };
        else doc[k] = v;
      }
      return { ...doc };
    },

    touchLastLogin: async (id, at) => {
      if (store.has(id)) store.get(id).lastLoginAt = at;
    },

    setOnboardingStatus: async (id, onboardingStatus) => {
      const doc = store.get(id);
      if (!doc) return null;
      doc.onboardingStatus = onboardingStatus;
      return { ...doc };
    },

    setOnboardingStatusById: async (userId, onboardingStatus) => {
      for (const doc of store.values()) {
        if (String(doc._id) === String(userId)) {
          doc.onboardingStatus = onboardingStatus;
          return { ...doc };
        }
      }
      return null;
    },

    syncIdentity: async (id, fields, clerkUpdatedAt) => {
      calls.syncIdentity += 1;
      const doc = store.get(id);
      if (!doc) return null;
      if (doc.clerkUpdatedAt && !(doc.clerkUpdatedAt < clerkUpdatedAt)) return null;
      Object.assign(doc, fields, { clerkUpdatedAt });
      return { ...doc };
    },

    markDeleted: async (id, at) => {
      calls.markDeleted += 1;
      const doc = store.get(id);
      if (!doc || doc.deletedAt) return null;
      Object.assign(doc, { accountStatus: 'DEACTIVATED', deletedAt: at });
      return { ...doc };
    },

    upsertAdmin: async (id, identity) => {
      const doc = store.get(id) ?? { _id: randomUUID(), createdAt: new Date(), clerkUserId: id, ...identity };
      Object.assign(doc, { role: 'ADMIN', accountStatus: 'ACTIVE' });
      store.set(id, doc);
      return { ...doc };
    },

    countByRole: async (role) => [...store.values()].filter((u) => u.role === role).length,
  };

  return { repo, store, calls };
};
