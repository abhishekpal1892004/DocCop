export const createFakeAbdmRepository = () => {
  const abhaLinks = new Map();
  const registryLinks = new Map();
  const consents = new Map();
  const exchanges = new Map();
  const webhooks = new Map();
  const fhirExports = [];
  const fhirImports = [];
  let seq = 1;
  const nextId = () => `65b0000000000000000000${String(seq++).padStart(2, '0')}`;

  const repo = {
    findAbhaByPatientId: async (patientId) =>
      abhaLinks.has(String(patientId)) ? structuredClone(abhaLinks.get(String(patientId))) : null,
    findAbhaByHash: async ({ abhaNumberHash, abhaAddressHash }) => {
      for (const link of abhaLinks.values()) {
        if (abhaNumberHash && link.abhaNumberHash === abhaNumberHash) return structuredClone(link);
        if (abhaAddressHash && link.abhaAddressHash === abhaAddressHash) return structuredClone(link);
      }
      return null;
    },
    upsertAbhaByPatientId: async (patientId, set) => {
      const key = String(patientId);
      const existing = abhaLinks.get(key) || { _id: nextId(), patientId, provider: 'ABDM', createdAt: new Date() };
      const updated = { ...existing, ...set, lastUpdatedAt: new Date(), updatedAt: new Date() };
      abhaLinks.set(key, updated);
      return structuredClone(updated);
    },
    countVerifiedAbha: async () => [...abhaLinks.values()].filter((l) => l.verificationStatus === 'VERIFIED').length,

    findRegistryLink: async (registryType, targetId) => {
      const key = `${registryType}:${targetId}`;
      return registryLinks.has(key) ? structuredClone(registryLinks.get(key)) : null;
    },
    findRegistryLinkById: async (id) => {
      for (const r of registryLinks.values()) {
        if (String(r._id) === String(id)) return structuredClone(r);
      }
      return null;
    },
    upsertRegistryLink: async (registryType, targetId, set) => {
      const key = `${registryType}:${targetId}`;
      const existing = registryLinks.get(key) || { _id: nextId(), registryType, targetId, createdAt: new Date() };
      const updated = { ...existing, ...set, updatedAt: new Date() };
      registryLinks.set(key, updated);
      return structuredClone(updated);
    },
    updateRegistryLinkById: async (id, set) => {
      for (const [key, r] of registryLinks.entries()) {
        if (String(r._id) === String(id)) {
          const updated = { ...r, ...set, updatedAt: new Date() };
          registryLinks.set(key, updated);
          return structuredClone(updated);
        }
      }
      return null;
    },
    countRegistryLinks: async (registryType) =>
      [...registryLinks.values()].filter((r) => r.registryType === registryType).length,

    createConsent: async (data) => {
      const id = nextId();
      const doc = { _id: id, ...data, createdAt: new Date(), updatedAt: new Date() };
      consents.set(id, doc);
      return structuredClone(doc);
    },
    findConsentById: async (id) => (consents.has(String(id)) ? structuredClone(consents.get(String(id))) : null),
    findConsentByRequestId: async (consentRequestId) => {
      for (const c of consents.values()) {
        if (c.consentRequestId === consentRequestId) return structuredClone(c);
      }
      return null;
    },
    findConsentByManagerRef: async (ref) => {
      for (const c of consents.values()) {
        if (c.consentManagerReference === ref) return structuredClone(c);
      }
      return null;
    },
    listConsentsByPatient: async (patientId) =>
      [...consents.values()].filter((c) => String(c.patientId) === String(patientId)).map((c) => structuredClone(c)),
    updateConsentById: async (id, set) => {
      const c = consents.get(String(id));
      if (!c) return null;
      Object.assign(c, set, { updatedAt: new Date() });
      return structuredClone(c);
    },

    createExchange: async (data) => {
      const id = nextId();
      const doc = { _id: id, ...data, createdAt: new Date(), updatedAt: new Date() };
      exchanges.set(id, doc);
      return structuredClone(doc);
    },
    findExchangeById: async (id) => (exchanges.has(String(id)) ? structuredClone(exchanges.get(String(id))) : null),
    findExchangeByRequestId: async (requestId) => {
      for (const e of exchanges.values()) {
        if (e.requestId === requestId) return structuredClone(e);
      }
      return null;
    },
    findExchangeByTransactionId: async (transactionId) => {
      for (const e of exchanges.values()) {
        if (e.transactionId === transactionId) return structuredClone(e);
      }
      return null;
    },
    findExchangeByHealthRecordAndRole: async (healthRecordId, role) => {
      for (const e of exchanges.values()) {
        if (String(e.healthRecordId) === String(healthRecordId) && e.role === role && e.status !== 'FAILED') {
          return structuredClone(e);
        }
      }
      return null;
    },
    listExchangesByPatient: async (patientId) =>
      [...exchanges.values()].filter((e) => String(e.patientId) === String(patientId)).map((e) => structuredClone(e)),
    listRecentExchanges: async (limit = 20) => [...exchanges.values()].slice(-limit).reverse().map((e) => structuredClone(e)),
    updateExchangeById: async (id, set) => {
      const e = exchanges.get(String(id));
      if (!e) return null;
      Object.assign(e, set, { updatedAt: new Date() });
      return structuredClone(e);
    },
    getExchangeStats: async () => {
      const list = [...exchanges.values()];
      return {
        hipTotal: list.filter((e) => e.role === 'HIP').length,
        hiuTotal: list.filter((e) => e.role === 'HIU').length,
        completed: list.filter((e) => e.status === 'COMPLETED').length,
        failed: list.filter((e) => e.status === 'FAILED').length,
      };
    },

    findWebhookByEventId: async (eventId) =>
      webhooks.has(String(eventId)) ? structuredClone(webhooks.get(String(eventId))) : null,
    createWebhookEvent: async (data) => {
      const id = nextId();
      const doc = { _id: id, ...data, createdAt: new Date(), updatedAt: new Date() };
      webhooks.set(String(data.eventId), doc);
      return structuredClone(doc);
    },
    updateWebhookById: async (id, set) => {
      for (const w of webhooks.values()) {
        if (String(w._id) === String(id)) {
          Object.assign(w, set, { updatedAt: new Date() });
          return structuredClone(w);
        }
      }
      return null;
    },
    countPendingWebhooks: async () => [...webhooks.values()].filter((w) => w.processingStatus === 'RECEIVED').length,
    getConnectionRecord: async () => null,

    createFhirExport: async (data) => {
      const doc = { _id: nextId(), ...data, createdAt: new Date() };
      fhirExports.push(doc);
      return structuredClone(doc);
    },
    findFhirImportByBundle: async (patientId, externalBundleId) => {
      const found = fhirImports.find(
        (i) => String(i.patientId) === String(patientId) && i.externalBundleId === externalBundleId
      );
      return found ? structuredClone(found) : null;
    },
    createFhirImport: async (data) => {
      const doc = { _id: nextId(), ...data, isExternal: true, importedAt: new Date(), createdAt: new Date() };
      fhirImports.push(doc);
      return structuredClone(doc);
    },
    listFhirImportsByPatient: async (patientId) =>
      fhirImports.filter((i) => String(i.patientId) === String(patientId)).map((i) => structuredClone(i)),
  };

  return { repo, abhaLinks, registryLinks, consents, exchanges, webhooks, fhirExports, fhirImports };
};
