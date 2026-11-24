import { User } from './user.model.js';

/**
 * Data-access layer for users. All methods return plain objects (lean) or null.
 * Kept as an object so tests can substitute an in-memory implementation.
 */
export const userRepository = {
  findById: (id) => User.findById(id).lean(),

  findByClerkUserId: (clerkUserId) => User.findOne({ clerkUserId }).lean(),

  async create(data) {
    const doc = await User.create(data);
    return doc.toObject();
  },

  updateProfile: (clerkUserId, set) =>
    User.findOneAndUpdate({ clerkUserId }, { $set: set }, { new: true, runValidators: true }).lean(),

  touchLastLogin: (clerkUserId, at) => User.updateOne({ clerkUserId }, { $set: { lastLoginAt: at } }),

  setOnboardingStatus: (clerkUserId, onboardingStatus) =>
    User.findOneAndUpdate({ clerkUserId }, { $set: { onboardingStatus } }, { new: true, runValidators: true }).lean(),

  setOnboardingStatusById: (userId, onboardingStatus) =>
    User.findByIdAndUpdate(userId, { $set: { onboardingStatus } }, { new: true, runValidators: true }).lean(),

  /** Apply Clerk identity fields only if the event is newer than the last applied one. */
  syncIdentity: (clerkUserId, fields, clerkUpdatedAt) =>
    User.findOneAndUpdate(
      {
        clerkUserId,
        $or: [{ clerkUpdatedAt: { $exists: false } }, { clerkUpdatedAt: null }, { clerkUpdatedAt: { $lt: clerkUpdatedAt } }],
      },
      { $set: { ...fields, clerkUpdatedAt } },
      { new: true, runValidators: true }
    ).lean(),

  /** Soft-delete: deactivate once; later calls match nothing (idempotent). */
  markDeleted: (clerkUserId, at) =>
    User.findOneAndUpdate(
      { clerkUserId, deletedAt: { $exists: false } },
      { $set: { accountStatus: 'DEACTIVATED', deletedAt: at } },
      { new: true }
    ).lean(),

  /** Trusted server-side only (admin provisioning). */
  upsertAdmin: (clerkUserId, identity) =>
    User.findOneAndUpdate(
      { clerkUserId },
      {
        $set: { role: 'ADMIN', accountStatus: 'ACTIVE' },
        $setOnInsert: identity,
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean(),

  countByRole: (role) => User.countDocuments({ role }),
};
