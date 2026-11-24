import { Prescription } from './models/prescription.model.js';
import { PrescriptionSequence } from './models/prescriptionSequence.model.js';
import { PRESCRIPTION_STATUS } from './prescription.constants.js';

export const prescriptionRepository = {
  async nextPrescriptionNumber(year = new Date().getUTCFullYear()) {
    const key = `RX-${year}`;
    const doc = await PrescriptionSequence.findOneAndUpdate(
      { _id: key },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    ).lean();
    return `MB-${key}-${String(doc.seq).padStart(6, '0')}`;
  },

  async create(data) {
    const doc = await Prescription.create(data);
    return doc.toObject();
  },

  findById: (id) => Prescription.findById(id).lean(),

  updateDraftById: (id, doctorId, set) =>
    Prescription.findOneAndUpdate(
      { _id: id, doctorId, status: PRESCRIPTION_STATUS.DRAFT },
      { $set: set },
      { new: true, runValidators: true }
    ).lean(),

  transitionStatusById: (id, doctorId, allowedStatuses, set) =>
    Prescription.findOneAndUpdate(
      { _id: id, doctorId, status: { $in: allowedStatuses } },
      { $set: set },
      { new: true, runValidators: true }
    ).lean(),

  async listByPatient(patientId, { page = 1, limit = 20 }) {
    const filter = {
      patientId,
      status: { $in: [PRESCRIPTION_STATUS.ISSUED, PRESCRIPTION_STATUS.AMENDED, PRESCRIPTION_STATUS.VOIDED] },
    };
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      Prescription.find(filter).sort({ issuedAt: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
      Prescription.countDocuments(filter),
    ]);
    return { items, total, page, limit };
  },

  async listByDoctor(doctorId, { status, page = 1, limit = 20 }) {
    const filter = { doctorId };
    if (status) filter.status = status;
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      Prescription.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Prescription.countDocuments(filter),
    ]);
    return { items, total, page, limit };
  },
};
