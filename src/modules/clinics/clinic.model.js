import mongoose from 'mongoose';
import { E164_REGEX } from '../patients/patient.constants.js';
import { CLINIC_TYPES, PINCODE_REGEX } from '../doctorApplications/doctorApplication.constants.js';
import { CLINIC_VERIFICATION_STATUS } from './clinic.constants.js';

const s = (max) => ({ type: String, trim: true, maxlength: max });

const clinicSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null },
    clinicName: { ...s(200), required: true },
    clinicType: { type: String, enum: CLINIC_TYPES, default: 'CLINIC' },
    registrationNumber: s(50),
    registrationAuthority: s(150),
    registrationType: s(100),
    ownerName: s(120),
    contactNumber: { ...s(16), match: [E164_REGEX, 'Contact number must be in E.164 format'] },
    address: {
      street: s(200),
      city: s(100),
      district: s(100),
      state: s(100),
      country: s(100),
      pincode: { ...s(6), match: [PINCODE_REGEX, 'Invalid pincode'] },
    },
    verificationStatus: {
      type: String,
      enum: Object.values(CLINIC_VERIFICATION_STATUS),
      default: CLINIC_VERIFICATION_STATUS.PENDING,
    },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    verifiedAt: Date,
    verificationRemarks: s(1000),
  },
  { timestamps: true }
);

clinicSchema.index({ verificationStatus: 1, createdAt: -1 });
clinicSchema.index({ organizationId: 1 });
clinicSchema.index({ 'address.city': 1, 'address.state': 1 });
clinicSchema.index({ registrationNumber: 1, registrationAuthority: 1 });

export const Clinic = mongoose.models.Clinic ?? mongoose.model('Clinic', clinicSchema);
