import { PatientProfile } from './patient.model.js';

export const patientRepository = {
  findByUserId: (userId) => PatientProfile.findOne({ userId }).lean(),

  async create(data) {
    const doc = await PatientProfile.create(data);
    return doc.toObject();
  },

  updateByUserId: (userId, set) =>
    PatientProfile.findOneAndUpdate({ userId }, { $set: set }, { new: true, runValidators: true }).lean(),
};
