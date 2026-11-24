import mongoose from 'mongoose';

export const ABDM_CONSENT_STATUS = Object.freeze({
  REQUESTED: 'REQUESTED',
  PENDING: 'PENDING',
  GRANTED: 'GRANTED',
  DENIED: 'DENIED',
  REJECTED: 'REJECTED',
  REVOKED: 'REVOKED',
  EXPIRED: 'EXPIRED',
  FAILED: 'FAILED',
});

const abdmConsentSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    consentManagerReference: { type: String, trim: true, default: null, index: true },
    consentRequestId: { type: String, trim: true, required: true, unique: true, index: true },
    purpose: { type: String, trim: true, required: true, maxlength: 200 },
    requesterId: { type: String, trim: true, required: true },
    requesterRole: { type: String, trim: true, default: 'PATIENT' },
    recordTypes: { type: [String], default: [] },
    dateRange: {
      from: { type: Date, required: true },
      to: { type: Date, required: true },
    },
    status: {
      type: String,
      enum: Object.values(ABDM_CONSENT_STATUS),
      default: ABDM_CONSENT_STATUS.REQUESTED,
      index: true,
    },
    grantedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

export const AbdmConsent = mongoose.models.AbdmConsent || mongoose.model('AbdmConsent', abdmConsentSchema);
