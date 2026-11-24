import mongoose from 'mongoose';
import { REVIEW_MODERATION_STATUS } from './review.constants.js';
import { Review } from './review.model.js';

export const reviewRepository = {
  async create(data) {
    const doc = await Review.create(data);
    return doc.toObject();
  },

  findById: (id) => Review.findById(id).lean(),

  findByPatientAndAppointment: (patientId, appointmentId) =>
    Review.findOne({ patientId, appointmentId }).lean(),

  updateById: (id, set) =>
    Review.findByIdAndUpdate(id, { $set: set }, { new: true, runValidators: true }).lean(),

  deleteById: (id) => Review.findByIdAndDelete(id).lean(),

  incrementReportCount: (id) =>
    Review.findByIdAndUpdate(
      id,
      { $inc: { reportedCount: 1 }, $set: { moderationStatus: REVIEW_MODERATION_STATUS.FLAGGED } },
      { new: true }
    ).lean(),

  async listApprovedByDoctor(doctorId, { page = 1, limit = 20 }) {
    const filter = { doctorId, moderationStatus: REVIEW_MODERATION_STATUS.APPROVED };
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      Review.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      Review.countDocuments(filter),
    ]);
    return { items, total, page, limit };
  },

  async listByPatient(patientId, { page = 1, limit = 20 }) {
    const filter = { patientId };
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      Review.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      Review.countDocuments(filter),
    ]);
    return { items, total, page, limit };
  },

  async listForModeration({ moderationStatus, page = 1, limit = 20 }) {
    const filter = {};
    if (moderationStatus) filter.moderationStatus = moderationStatus;
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      Review.find(filter).sort({ reportedCount: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
      Review.countDocuments(filter),
    ]);
    return { items, total, page, limit };
  },

  async getDoctorRatingSummary(doctorId) {
    const id = typeof doctorId === 'string' && mongoose.isValidObjectId(doctorId)
      ? new mongoose.Types.ObjectId(doctorId)
      : doctorId;

    const rows = await Review.aggregate([
      { $match: { doctorId: id, moderationStatus: REVIEW_MODERATION_STATUS.APPROVED } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
    ]);

    const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let totalReviews = 0;
    let weightedSum = 0;
    for (const r of rows) {
      dist[r._id] = r.count;
      totalReviews += r.count;
      weightedSum += r._id * r.count;
    }

    return {
      averageRating: totalReviews > 0 ? Number((weightedSum / totalReviews).toFixed(2)) : 0,
      totalReviews,
      distribution: dist,
    };
  },
};
