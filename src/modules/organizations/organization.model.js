import mongoose from 'mongoose';
import { E164_REGEX } from '../patients/patient.constants.js';

export const ORGANIZATION_STATUS = Object.freeze({
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
});

const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true, maxlength: 200 },
    legalName: { type: String, trim: true, maxlength: 200 },
    organizationType: { type: String, trim: true, maxlength: 100, default: 'HEALTHCARE_GROUP' },
    ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    contactEmail: { type: String, trim: true, lowercase: true, maxlength: 254 },
    contactPhone: { type: String, trim: true, match: [E164_REGEX, 'Phone number must be in E.164 format'] },
    status: {
      type: String,
      enum: Object.values(ORGANIZATION_STATUS),
      default: ORGANIZATION_STATUS.ACTIVE,
    },
  },
  { timestamps: true }
);

organizationSchema.index({ status: 1 });

export const Organization =
  mongoose.models.Organization ?? mongoose.model('Organization', organizationSchema);
