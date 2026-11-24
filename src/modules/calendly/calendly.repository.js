import { AppointmentType } from './appointmentType.model.js';
import { CalendlyConnection } from './calendlyConnection.model.js';
import { CalendlyOAuthState } from './calendlyOAuthState.model.js';

export const calendlyRepository = {
  // OAuth State
  async createOAuthState(data) {
    const doc = await CalendlyOAuthState.create(data);
    return doc.toObject();
  },

  consumeOAuthState: (state, now = new Date()) =>
    CalendlyOAuthState.findOneAndUpdate(
      { state, consumedAt: null, expiresAt: { $gt: now } },
      { $set: { consumedAt: now } },
      { new: true }
    ).lean(),

  // Connections
  findConnectionByDoctorId: (doctorId) => CalendlyConnection.findOne({ doctorId }).lean(),

  findConnectionByUserUri: (calendlyUserUri) => CalendlyConnection.findOne({ calendlyUserUri }).lean(),

  upsertConnection: (doctorId, data) =>
    CalendlyConnection.findOneAndUpdate(
      { doctorId },
      { $set: data },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean(),

  updateConnectionByDoctorId: (doctorId, set) =>
    CalendlyConnection.findOneAndUpdate({ doctorId }, { $set: set }, { new: true, runValidators: true }).lean(),

  // Appointment Types
  findAppointmentTypeById: (id) => AppointmentType.findById(id).lean(),

  findAppointmentTypesByDoctorId: (doctorId, { activeOnly = false } = {}) => {
    const filter = { doctorId };
    if (activeOnly) filter.isActive = true;
    return AppointmentType.find(filter).sort({ createdAt: 1 }).lean();
  },

  upsertAppointmentType: (doctorId, calendlyEventTypeUri, data) =>
    AppointmentType.findOneAndUpdate(
      { doctorId, calendlyEventTypeUri },
      { $set: data },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean(),

  updateAppointmentTypeById: (id, doctorId, set) =>
    AppointmentType.findOneAndUpdate({ _id: id, doctorId }, { $set: set }, { new: true, runValidators: true }).lean(),
};
