import mongoose from 'mongoose';

export const ABHA_VERIFICATION_STATUS = Object.freeze({
  NOT_LINKED: 'NOT_LINKED',
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  FAILED: 'FAILED',
  REVOKED: 'REVOKED',
});

const abhaLinkSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    abhaNumberEncrypted: { type: String, default: null },
    abhaNumberHash: { type: String, unique: true, sparse: true },
    abhaNumberMasked: { type: String, default: null },
    abhaAddressEncrypted: { type: String, default: null },
    abhaAddressHash: { type: String, unique: true, sparse: true },
    abhaAddressMasked: { type: String, default: null },
    provider: { type: String, default: 'ABDM', immutable: true },
    verificationStatus: {
      type: String,
      enum: Object.values(ABHA_VERIFICATION_STATUS),
      default: ABHA_VERIFICATION_STATUS.NOT_LINKED,
    },
    pendingTxnId: { type: String, default: null },
    linkedAt: { type: Date, default: null },
    verifiedAt: { type: Date, default: null },
    consentStatus: { type: String, default: 'NONE' },
    lastUpdatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const AbhaLink = mongoose.models.AbhaLink || mongoose.model('AbhaLink', abhaLinkSchema);
