import { WAITLIST_STATUS, Waitlist } from './waitlist.model.js';
import { WAITLIST_OFFER_STATUS, WaitlistOffer } from './waitlistOffer.model.js';

export const waitlistRepository = {
  async create(data) {
    const doc = await Waitlist.create(data);
    return doc.toObject();
  },

  findById: (id) => Waitlist.findById(id).lean(),

  listByPatient: (patientId) =>
    Waitlist.find({ patientId }).sort({ createdAt: -1 }).lean(),

  findEligibleActive: (doctorId, appointmentTypeId) =>
    Waitlist.find({ doctorId, appointmentTypeId, status: WAITLIST_STATUS.ACTIVE })
      .sort({ createdAt: 1 })
      .limit(5)
      .lean(),

  updateById: (id, set) =>
    Waitlist.findByIdAndUpdate(id, { $set: set }, { new: true, runValidators: true }).lean(),

  // Offers
  async createOffer(data) {
    const doc = await WaitlistOffer.create(data);
    return doc.toObject();
  },

  findOfferById: (id) => WaitlistOffer.findById(id).lean(),

  claimPendingOffer: (id, patientId, now = new Date()) =>
    WaitlistOffer.findOneAndUpdate(
      { _id: id, patientId, status: WAITLIST_OFFER_STATUS.PENDING, expiresAt: { $gt: now } },
      { $set: { status: WAITLIST_OFFER_STATUS.ACCEPTED, acceptedAt: now } },
      { new: true }
    ).lean(),

  updateOfferById: (id, set) =>
    WaitlistOffer.findByIdAndUpdate(id, { $set: set }, { new: true, runValidators: true }).lean(),
};
