import { MedicalRecord } from './models/medicalRecord.model.js';
import { RecordAccess } from './models/recordAccess.model.js';
import { RECORD_STATUS } from './medicalRecord.constants.js';

export const medicalRecordRepository = {
  async create(data) {
    const doc = await MedicalRecord.create(data);
    return doc.toObject();
  },

  findById: (id) => MedicalRecord.findById(id).lean(),

  async listByPatient(patientId, { category, page = 1, limit = 20 }) {
    const filter = { patientId, recordStatus: RECORD_STATUS.ACTIVE };
    if (category) filter.category = category;
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      MedicalRecord.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      MedicalRecord.countDocuments(filter),
    ]);
    return { items, total, page, limit };
  },

  updateById: (id, set) =>
    MedicalRecord.findByIdAndUpdate(id, { $set: set }, { new: true, runValidators: true }).lean(),

  // Sharing / Access
  upsertAccess: ({ recordId, patientId, doctorId, doctorUserId, grantedBy }) =>
    RecordAccess.findOneAndUpdate(
      { recordId, doctorId },
      {
        $set: {
          patientId,
          doctorUserId,
          grantedBy,
          status: 'ACTIVE',
          grantedAt: new Date(),
          revokedAt: null,
        },
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean(),

  revokeAccess: (recordId, doctorId) =>
    RecordAccess.findOneAndUpdate(
      { recordId, doctorId, status: 'ACTIVE' },
      { $set: { status: 'REVOKED', revokedAt: new Date() } },
      { new: true }
    ).lean(),

  findActiveAccess: (recordId, doctorUserId) =>
    RecordAccess.findOne({ recordId, doctorUserId, status: 'ACTIVE' }).lean(),
};
