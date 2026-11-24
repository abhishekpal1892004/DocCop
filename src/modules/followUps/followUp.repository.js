import { FollowUp } from './followUp.model.js';

export const followUpRepository = {
  async create(data) {
    const doc = await FollowUp.create(data);
    return doc.toObject();
  },

  findById: (id) => FollowUp.findById(id).lean(),

  listByPatient: (patientId) => FollowUp.find({ patientId }).sort({ recommendedDate: 1 }).lean(),

  listByDoctor: (doctorId) => FollowUp.find({ doctorId }).sort({ createdAt: -1 }).lean(),

  updateById: (id, set) =>
    FollowUp.findByIdAndUpdate(id, { $set: set }, { new: true, runValidators: true }).lean(),
};
