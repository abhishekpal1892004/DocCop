import { DoctorApplication } from './doctorApplication.model.js';

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const doctorApplicationRepository = {
  findById: (id) => DoctorApplication.findById(id).lean(),

  findByUserId: (userId) => DoctorApplication.findOne({ userId }).lean(),

  async create(data) {
    const doc = await DoctorApplication.create(data);
    return doc.toObject();
  },

  /**
   * Atomic update guarded by allowed statuses (so a concurrent submit cannot be overwritten).
   * Returns the updated document, or null if no document matched (missing or locked).
   */
  update: (userId, set, allowedStatuses) =>
    DoctorApplication.findOneAndUpdate(
      { userId, applicationStatus: { $in: allowedStatuses } },
      { $set: set },
      { new: true, runValidators: true }
    ).lean(),

  async listForReview({ status, state, q, nmcVerificationStatus, sortOrder = 'asc', page = 1, limit = 20 }) {
    const filter = {};
    if (status) filter.applicationStatus = status;
    if (state) filter['medicalRegistration.stateCode'] = state.toUpperCase();
    if (nmcVerificationStatus) filter.nmcVerificationStatus = nmcVerificationStatus;
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      filter.$or = [
        { 'personalDetails.fullName': rx },
        { 'medicalRegistration.registrationNumber': rx },
        { 'clinicDetails.clinicName': rx },
      ];
    }

    const dir = sortOrder === 'desc' ? -1 : 1;
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      DoctorApplication.find(filter).sort({ submittedAt: dir, createdAt: dir }).skip(skip).limit(limit).lean(),
      DoctorApplication.countDocuments(filter),
    ]);
    return { items, total, page, limit };
  },

  reviewTransition: (applicationId, allowedStatuses, set, { session } = {}) =>
    DoctorApplication.findOneAndUpdate(
      { _id: applicationId, applicationStatus: { $in: allowedStatuses } },
      { $set: set },
      { new: true, runValidators: true, ...(session ? { session } : {}) }
    ).lean(),

  countByStatuses: (statuses) => DoctorApplication.countDocuments({ applicationStatus: { $in: statuses } }),
};
