import { randomUUID } from 'node:crypto';

export const createFakePatientRepository = () => {
  const store = new Map();
  const repo = {
    findByUserId: async (userId) => (store.has(String(userId)) ? { ...store.get(String(userId)) } : null),
    create: async (data) => {
      const key = String(data.userId);
      if (store.has(key)) throw Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
      const doc = { _id: randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...data };
      store.set(key, doc);
      return { ...doc };
    },
    updateByUserId: async (userId, set) => {
      const doc = store.get(String(userId));
      if (!doc) return null;
      for (const [k, v] of Object.entries(set)) {
        const parts = k.split('.');
        if (parts.length === 2) {
          doc[parts[0]] = { ...(doc[parts[0]] ?? {}), [parts[1]]: v };
        } else {
          doc[k] = v;
        }
      }
      doc.updatedAt = new Date();
      return { ...doc };
    },
  };
  return { repo, store };
};
