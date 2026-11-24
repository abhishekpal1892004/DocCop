import mongoose from 'mongoose';
import { NMC_PROVIDER_NAME, LOOKUP_STATUS, FIELD_RESULT } from '../../integrations/nmc/nmc.constants.js';

const matchedRecordSchema = new mongoose.Schema(
  {
    // Minimal, sanitized register fields only (no DOB, father's name, address, ...).
    name: String,
    registrationNumber: String,
    registrationYear: Number,
    stateCode: String,
    councilName: String,
    qualification: String,
    qualificationYear: Number,
    university: String,
    removedStatus: String,
    comparison: {
      registrationNumber: { type: String, enum: Object.values(FIELD_RESULT) },
      registrationYear: { type: String, enum: Object.values(FIELD_RESULT) },
      council: { type: String, enum: Object.values(FIELD_RESULT) },
      name: { type: String, enum: Object.values(FIELD_RESULT) },
    },
  },
  { _id: false }
);

const nmcLookupSchema = new mongoose.Schema(
  {
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'DoctorApplication', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    provider: { type: String, default: NMC_PROVIDER_NAME },
    searchParams: {
      name: String,
      registrationNumber: String,
      registrationYear: Number,
      state: String,
    },
    lookupStatus: { type: String, enum: Object.values(LOOKUP_STATUS), required: true },
    matchedRecords: { type: [matchedRecordSchema], default: [] },
    resultCount: { type: Number, default: 0 },
    summary: String,
    manualReviewRequired: { type: Boolean, default: true },
    checkedAt: { type: Date, default: Date.now },
    // Set when the doctor changes registration details after this lookup.
    supersededAt: Date,
  },
  { timestamps: true }
);

nmcLookupSchema.index({ applicationId: 1, checkedAt: -1 });

export const NmcLookup = mongoose.models.NmcLookup ?? mongoose.model('NmcLookup', nmcLookupSchema);
