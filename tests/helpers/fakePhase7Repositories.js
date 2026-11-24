import { randomUUID } from 'node:crypto';
import { RECORD_STATUS } from '../../src/modules/medicalRecords/medicalRecord.constants.js';
import { PRESCRIPTION_STATUS } from '../../src/modules/prescriptions/prescription.constants.js';
import { CONSULTATION_STATUS } from '../../src/modules/consultations/consultation.model.js';

export const createFakeDocumentStorage = () => {
  const files = new Map();
  const service = {
    uploadEncryptedBuffer: async (buffer) => {
      const id = randomUUID();
      files.set(id, Buffer.from(buffer));
      return id;
    },
    downloadEncryptedBuffer: async (id) => {
      const buf = files.get(String(id));
      if (!buf) throw new Error('GridFS file not found');
      return Buffer.from(buf);
    },
    deleteFile: async (id) => {
      files.delete(String(id));
    },
  };
  return { service, files };
};

export const createFakeMedicalRecordRepository = () => {
  const records = new Map();
  const accesses = new Map();

  const repo = {
    create: async (data) => {
      const doc = { _id: randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...structuredClone(data) };
      records.set(String(doc._id), doc);
      return structuredClone(doc);
    },
    findById: async (id) => (records.has(String(id)) ? structuredClone(records.get(String(id))) : null),
    listByPatient: async (patientId, { category, page = 1, limit = 20 }) => {
      let items = [...records.values()].filter(
        (r) => String(r.patientId) === String(patientId) && r.recordStatus === RECORD_STATUS.ACTIVE
      );
      if (category) items = items.filter((r) => r.category === category);
      const total = items.length;
      const start = (page - 1) * limit;
      return { items: items.slice(start, start + limit).map((r) => structuredClone(r)), total, page, limit };
    },
    updateById: async (id, set) => {
      const doc = records.get(String(id));
      if (!doc) return null;
      Object.assign(doc, set, { updatedAt: new Date() });
      return structuredClone(doc);
    },
    upsertAccess: async ({ recordId, patientId, doctorId, doctorUserId, grantedBy }) => {
      const key = `${recordId}:${doctorId}`;
      const existing = accesses.get(key);
      const doc = {
        _id: existing?._id ?? randomUUID(),
        recordId,
        patientId,
        doctorId,
        doctorUserId,
        grantedBy,
        status: 'ACTIVE',
        grantedAt: new Date(),
        revokedAt: null,
      };
      accesses.set(key, doc);
      return structuredClone(doc);
    },
    revokeAccess: async (recordId, doctorId) => {
      const key = `${recordId}:${doctorId}`;
      const doc = accesses.get(key);
      if (!doc || doc.status !== 'ACTIVE') return null;
      doc.status = 'REVOKED';
      doc.revokedAt = new Date();
      return structuredClone(doc);
    },
    findActiveAccess: async (recordId, doctorUserId) => {
      for (const a of accesses.values()) {
        if (String(a.recordId) === String(recordId) && String(a.doctorUserId) === String(doctorUserId) && a.status === 'ACTIVE') {
          return structuredClone(a);
        }
      }
      return null;
    },
  };
  return { repo, records, accesses };
};

export const createFakePrescriptionRepository = () => {
  const store = new Map();
  let seq = 0;
  const repo = {
    nextPrescriptionNumber: async (year = new Date().getUTCFullYear()) => {
      seq += 1;
      return `MB-RX-${year}-${String(seq).padStart(6, '0')}`;
    },
    create: async (data) => {
      const doc = { _id: randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...structuredClone(data) };
      store.set(String(doc._id), doc);
      return structuredClone(doc);
    },
    findById: async (id) => (store.has(String(id)) ? structuredClone(store.get(String(id))) : null),
    updateDraftById: async (id, doctorId, set) => {
      const doc = store.get(String(id));
      if (!doc || String(doc.doctorId) !== String(doctorId) || doc.status !== PRESCRIPTION_STATUS.DRAFT) return null;
      Object.assign(doc, set, { updatedAt: new Date() });
      return structuredClone(doc);
    },
    transitionStatusById: async (id, doctorId, allowedStatuses, set) => {
      const doc = store.get(String(id));
      if (!doc || String(doc.doctorId) !== String(doctorId) || !allowedStatuses.includes(doc.status)) return null;
      Object.assign(doc, set, { updatedAt: new Date() });
      return structuredClone(doc);
    },
    listByPatient: async (patientId, { page = 1, limit = 20 }) => {
      const items = [...store.values()].filter(
        (p) =>
          String(p.patientId) === String(patientId) &&
          [PRESCRIPTION_STATUS.ISSUED, PRESCRIPTION_STATUS.AMENDED, PRESCRIPTION_STATUS.VOIDED].includes(p.status)
      );
      const total = items.length;
      const start = (page - 1) * limit;
      return { items: items.slice(start, start + limit).map((p) => structuredClone(p)), total, page, limit };
    },
    listByDoctor: async (doctorId, { status, page = 1, limit = 20 }) => {
      let items = [...store.values()].filter((p) => String(p.doctorId) === String(doctorId));
      if (status) items = items.filter((p) => p.status === status);
      const total = items.length;
      const start = (page - 1) * limit;
      return { items: items.slice(start, start + limit).map((p) => structuredClone(p)), total, page, limit };
    },
  };
  return { repo, store };
};

export const createFakeConsultationRepository = () => {
  const store = new Map();
  const repo = {
    create: async (data) => {
      const doc = { _id: randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...structuredClone(data) };
      store.set(String(doc._id), doc);
      return structuredClone(doc);
    },
    findById: async (id) => (store.has(String(id)) ? structuredClone(store.get(String(id))) : null),
    findByAppointmentId: async (appointmentId) => {
      for (const c of store.values()) {
        if (String(c.appointmentId) === String(appointmentId)) return structuredClone(c);
      }
      return null;
    },
    updateById: async (id, doctorId, set) => {
      const doc = store.get(String(id));
      if (!doc || String(doc.doctorId) !== String(doctorId)) return null;
      Object.assign(doc, set, { updatedAt: new Date() });
      return structuredClone(doc);
    },
    listByPatient: async (patientId, { page = 1, limit = 20 }) => {
      const items = [...store.values()].filter(
        (c) => String(c.patientId) === String(patientId) && c.status === CONSULTATION_STATUS.COMPLETED
      );
      const total = items.length;
      const start = (page - 1) * limit;
      return { items: items.slice(start, start + limit).map((c) => structuredClone(c)), total, page, limit };
    },
    listByDoctor: async (doctorId, { page = 1, limit = 20 }) => {
      const items = [...store.values()].filter((c) => String(c.doctorId) === String(doctorId));
      const total = items.length;
      const start = (page - 1) * limit;
      return { items: items.slice(start, start + limit).map((c) => structuredClone(c)), total, page, limit };
    },
  };
  return { repo, store };
};
