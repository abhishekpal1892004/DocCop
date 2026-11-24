import { Appointment } from './appointment.model.js';
import { BookingAttempt } from './bookingAttempt.model.js';

export const appointmentRepository = {
  findById: (id) => Appointment.findById(id).lean(),

  findByInviteeUri: (calendlyInviteeUri) => Appointment.findOne({ calendlyInviteeUri }).lean(),

  findByEventUri: (calendlyEventUri) => Appointment.findOne({ calendlyEventUri }).lean(),

  async create(data, { session } = {}) {
    const [doc] = await Appointment.create([data], session ? { session } : undefined);
    return doc.toObject();
  },

  updateById: (id, set, { session } = {}) =>
    Appointment.findByIdAndUpdate(
      id,
      { $set: set },
      { new: true, runValidators: true, ...(session ? { session } : {}) }
    ).lean(),

  upsertByInviteeUri: (calendlyInviteeUri, data) =>
    Appointment.findOneAndUpdate(
      { calendlyInviteeUri },
      { $set: data },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean(),

  async list(filter, { sortDir = -1, page = 1, limit = 20 }) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      Appointment.find(filter).sort({ startAt: sortDir, _id: sortDir }).skip(skip).limit(limit).lean(),
      Appointment.countDocuments(filter),
    ]);
    return { items, total, page, limit };
  },

  // Booking attempts
  findAttemptByKey: (patientId, idempotencyKey) =>
    BookingAttempt.findOne({ patientId, idempotencyKey }).lean(),

  async createAttempt(data) {
    const doc = await BookingAttempt.create(data);
    return doc.toObject();
  },

  updateAttemptById: (id, set, { session } = {}) =>
    BookingAttempt.findByIdAndUpdate(
      id,
      { $set: set },
      { new: true, runValidators: true, ...(session ? { session } : {}) }
    ).lean(),
};
