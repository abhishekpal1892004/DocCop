import mongoose from 'mongoose';

const registryLinkSchema = new mongoose.Schema(
  {
    registryType: { type: String, enum: ['HPR', 'HFR'], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    registryId: { type: String, trim: true, required: true },
    source: { type: String, default: 'ABDM' },
    lookupTimestamp: { type: Date, default: null },
    registryStatus: { type: String, trim: true, default: null },
    facilityName: { type: String, trim: true, default: null },
    facilityAddress: { type: String, trim: true, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    verificationResult: {
      type: String,
      enum: ['NOT_VERIFIED', 'MATCH_FOUND', 'MISMATCH', 'LOOKUP_FAILED'],
      default: 'NOT_VERIFIED',
    },
    adminReviewStatus: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

registryLinkSchema.index({ registryType: 1, targetId: 1 }, { unique: true });

export const RegistryLink = mongoose.models.RegistryLink || mongoose.model('RegistryLink', registryLinkSchema);
