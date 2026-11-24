import { DoctorVerification } from './verification.model.js';

export const doctorVerificationRepository = {
  findByApplicationId: (applicationId) => DoctorVerification.findOne({ applicationId }).lean(),

  findByUserId: (userId) => DoctorVerification.findOne({ userId }).lean(),

  upsertInitial: (applicationId, userId, initial) =>
    DoctorVerification.findOneAndUpdate(
      { applicationId },
      {
        $setOnInsert: {
          applicationId,
          userId,
          ...initial,
        },
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean(),

  updateTrack: (applicationId, set) =>
    DoctorVerification.findOneAndUpdate(
      { applicationId },
      { $set: set },
      { new: true, runValidators: true }
    ).lean(),
};
