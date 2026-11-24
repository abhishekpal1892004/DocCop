import { AbdmConnection } from './models/abdmConnection.model.js';
import { AbdmConsent } from './models/abdmConsent.model.js';
import { AbdmExchange } from './models/abdmExchange.model.js';
import { AbdmWebhookEvent } from './models/abdmWebhookEvent.model.js';
import { AbhaLink } from './models/abhaLink.model.js';
import { FhirExport } from './models/fhirExport.model.js';
import { FhirImport } from './models/fhirImport.model.js';
import { RegistryLink } from './models/registryLink.model.js';

export const abdmRepository = {
  // ABHA
  findAbhaByPatientId: (patientId) => AbhaLink.findOne({ patientId }).lean(),
  findAbhaByHash: ({ abhaNumberHash, abhaAddressHash }) => {
    const or = [];
    if (abhaNumberHash) or.push({ abhaNumberHash });
    if (abhaAddressHash) or.push({ abhaAddressHash });
    if (or.length === 0) return Promise.resolve(null);
    return AbhaLink.findOne({ $or: or }).lean();
  },
  upsertAbhaByPatientId: (patientId, set) =>
    AbhaLink.findOneAndUpdate(
      { patientId },
      { $set: { ...set, lastUpdatedAt: new Date() } },
      { new: true, upsert: true, runValidators: true }
    ).lean(),
  countVerifiedAbha: () => AbhaLink.countDocuments({ verificationStatus: 'VERIFIED' }),

  // HPR & HFR
  findRegistryLink: (registryType, targetId) => RegistryLink.findOne({ registryType, targetId }).lean(),
  findRegistryLinkById: (id) => RegistryLink.findById(id).lean(),
  upsertRegistryLink: (registryType, targetId, set) =>
    RegistryLink.findOneAndUpdate(
      { registryType, targetId },
      { $set: set },
      { new: true, upsert: true, runValidators: true }
    ).lean(),
  updateRegistryLinkById: (id, set) =>
    RegistryLink.findByIdAndUpdate(id, { $set: set }, { new: true, runValidators: true }).lean(),
  countRegistryLinks: (registryType) => RegistryLink.countDocuments({ registryType }),

  // Consents
  createConsent: async (data) => (await AbdmConsent.create(data)).toObject(),
  findConsentById: (id) => AbdmConsent.findById(id).lean(),
  findConsentByRequestId: (consentRequestId) => AbdmConsent.findOne({ consentRequestId }).lean(),
  findConsentByManagerRef: (consentManagerReference) => AbdmConsent.findOne({ consentManagerReference }).lean(),
  listConsentsByPatient: (patientId) => AbdmConsent.find({ patientId }).sort({ createdAt: -1 }).lean(),
  updateConsentById: (id, set) =>
    AbdmConsent.findByIdAndUpdate(id, { $set: set }, { new: true, runValidators: true }).lean(),

  // Exchanges
  createExchange: async (data) => (await AbdmExchange.create(data)).toObject(),
  findExchangeById: (id) => AbdmExchange.findById(id).lean(),
  findExchangeByRequestId: (requestId) => AbdmExchange.findOne({ requestId }).lean(),
  findExchangeByTransactionId: (transactionId) => AbdmExchange.findOne({ transactionId }).lean(),
  findExchangeByHealthRecordAndRole: (healthRecordId, role) =>
    AbdmExchange.findOne({ healthRecordId, role, status: { $ne: 'FAILED' } }).lean(),
  listExchangesByPatient: (patientId) => AbdmExchange.find({ patientId }).sort({ createdAt: -1 }).lean(),
  listRecentExchanges: (limit = 20) => AbdmExchange.find({}).sort({ createdAt: -1 }).limit(limit).lean(),
  updateExchangeById: (id, set) =>
    AbdmExchange.findByIdAndUpdate(id, { $set: set }, { new: true, runValidators: true }).lean(),
  getExchangeStats: async () => {
    const [hipTotal, hiuTotal, completed, failed] = await Promise.all([
      AbdmExchange.countDocuments({ role: 'HIP' }),
      AbdmExchange.countDocuments({ role: 'HIU' }),
      AbdmExchange.countDocuments({ status: 'COMPLETED' }),
      AbdmExchange.countDocuments({ status: 'FAILED' }),
    ]);
    return { hipTotal, hiuTotal, completed, failed };
  },

  // Webhooks
  findWebhookByEventId: (eventId) => AbdmWebhookEvent.findOne({ eventId }).lean(),
  createWebhookEvent: async (data) => (await AbdmWebhookEvent.create(data)).toObject(),
  updateWebhookById: (id, set) =>
    AbdmWebhookEvent.findByIdAndUpdate(id, { $set: set }, { new: true }).lean(),
  countPendingWebhooks: () => AbdmWebhookEvent.countDocuments({ processingStatus: 'RECEIVED' }),

  // Connection metadata
  getConnectionRecord: () => AbdmConnection.findOne({}).lean(),

  // FHIR Exports & Imports
  createFhirExport: async (data) => (await FhirExport.create(data)).toObject(),
  findFhirImportByBundle: (patientId, externalBundleId) =>
    FhirImport.findOne({ patientId, externalBundleId }).lean(),
  createFhirImport: async (data) => (await FhirImport.create(data)).toObject(),
  listFhirImportsByPatient: (patientId) => FhirImport.find({ patientId }).sort({ importedAt: -1 }).lean(),
};
