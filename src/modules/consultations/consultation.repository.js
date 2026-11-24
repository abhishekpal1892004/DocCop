import { Consultation, CONSULTATION_STATUS } from './consultation.model.js';

export const consultationRepository = {
  async create(data) {
    const doc = await Consultation.create(data);
    return doc.toObject();
  },

  findById: (id) => Consultation.findById(id).lean(),

  findByAppointmentId: (appointmentId) => Consultation.findOne({ appointmentId }).lean(),

  updateById: (id, doctorId, set) =>
    Consultation.findOneAndUpdate(
      { _id: id, doctorId },
      { $set: set },
      { new: true, runValidators: true }
    ).lean(),

  async listByPatient(patientId, { page = 1, limit = 20 }) {
    const filter = { patientId, status: CONSULTATION_STATUS.COMPLETED };
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      Consultation.find(filter).sort({ consultationDate: -1 }).skip(skip).limit(limit).lean(),
      Consultation.countDocuments(filter),
    ]);
    return { items, total, page, limit };
  },

  async listByDoctor(doctorId, { page = 1, limit = 20 }) {
    const filter = { doctorId };
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      Consultation.find(filter).sort({ consultationDate: -1 }).skip(skip).limit(limit).lean(),
      Consultation.countDocuments(filter),
    ]);
    return { items, total, page, limit };
  },
};
