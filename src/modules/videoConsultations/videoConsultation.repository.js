import { VideoConsultation } from './videoConsultation.model.js';

export const videoConsultationRepository = {
  findByAppointmentId: (appointmentId) => VideoConsultation.findOne({ appointmentId }).lean(),

  upsertForAppointment: (appointmentId, setOnInsert, set = {}) =>
    VideoConsultation.findOneAndUpdate(
      { appointmentId },
      { $setOnInsert: setOnInsert, ...(Object.keys(set).length ? { $set: set } : {}) },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean(),

  updateByAppointmentId: (appointmentId, set) =>
    VideoConsultation.findOneAndUpdate({ appointmentId }, { $set: set }, { new: true, runValidators: true }).lean(),
};
