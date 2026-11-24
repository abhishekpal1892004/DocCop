import mongoose from 'mongoose';

export const ABDM_EXCHANGE_STATUS = Object.freeze({
  INITIATED: 'INITIATED',
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  REVOKED: 'REVOKED',
});

const abdmExchangeSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    healthRecordId: { type: mongoose.Schema.Types.ObjectId, default: null },
    recordSourceType: { type: String, enum: ['PRESCRIPTION', 'CONSULTATION', 'MEDICAL_RECORD', 'EXTERNAL'], default: 'MEDICAL_RECORD' },
    direction: { type: String, enum: ['OUTBOUND', 'INBOUND'], required: true },
    role: { type: String, enum: ['HIP', 'HIU'], required: true },
    transactionId: { type: String, trim: true, required: true, index: true },
    requestId: { type: String, trim: true, required: true, unique: true, index: true },
    consentReference: { type: String, trim: true, default: null },
    recordType: { type: String, trim: true, required: true },
    fhirProfileVersion: { type: String, trim: true, default: 'ndhm.in#6.5.0' },
    facilityId: { type: String, trim: true, default: null },
    status: {
      type: String,
      enum: Object.values(ABDM_EXCHANGE_STATUS),
      default: ABDM_EXCHANGE_STATUS.INITIATED,
      index: true,
    },
    retrievedBundleSummary: { type: mongoose.Schema.Types.Mixed, default: null },
    errorMessage: { type: String, trim: true, default: null },
  },
  { timestamps: true }
);

abdmExchangeSchema.index({ patientId: 1, role: 1, createdAt: -1 });

export const AbdmExchange = mongoose.models.AbdmExchange || mongoose.model('AbdmExchange', abdmExchangeSchema);
