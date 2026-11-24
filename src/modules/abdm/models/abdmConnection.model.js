import mongoose from 'mongoose';

const abdmConnectionSchema = new mongoose.Schema(
  {
    environment: { type: String, enum: ['SANDBOX', 'PRODUCTION'], default: 'SANDBOX' },
    integrationRole: { type: [String], enum: ['HIP', 'HIU'], default: [] },
    facilityId: { type: String, trim: true, default: '' },
    integrationStatus: {
      type: String,
      enum: ['NOT_CONFIGURED', 'CONFIGURED', 'SANDBOX', 'TESTING', 'APPROVED', 'PRODUCTION', 'SUSPENDED'],
      default: 'NOT_CONFIGURED',
    },
    lastConnectionCheck: { type: Date, default: null },
  },
  { timestamps: true }
);

export const AbdmConnection =
  mongoose.models.AbdmConnection || mongoose.model('AbdmConnection', abdmConnectionSchema);
