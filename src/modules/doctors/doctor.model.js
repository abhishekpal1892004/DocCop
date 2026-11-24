import mongoose from 'mongoose';
import { E164_REGEX } from '../patients/patient.constants.js';
import { CLINIC_TYPES, MEDICAL_SYSTEMS, PINCODE_REGEX } from '../doctorApplications/doctorApplication.constants.js';

const s = (max) => ({ type: String, trim: true, maxlength: max });
const sub = (def) => ({ type: new mongoose.Schema(def, { _id: false }), default: () => ({}) });

const doctorSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, immutable: true },
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DoctorApplication',
      required: true,
      unique: true,
      immutable: true,
    },

    personalDetails: sub({
      fullName: s(120),
      phoneNumber: { ...s(16), match: [E164_REGEX, 'Phone number must be in E.164 format'] },
      email: { ...s(254), lowercase: true },
      profileImage: s(2048),
    }),

    professionalDetails: sub({
      qualification: s(200),
      specialization: s(100),
      experience: { type: Number, min: 0, max: 70 },
      medicalSystem: { type: String, enum: MEDICAL_SYSTEMS },
      collegeName: s(200),
    }),

    medicalRegistration: sub({
      councilName: s(150),
      registrationNumber: s(30),
      registrationYear: { type: Number, min: 1900 },
      stateCode: { ...s(5), uppercase: true },
    }),

    clinicDetails: sub({
      clinicName: s(200),
      clinicType: { type: String, enum: CLINIC_TYPES },
      address: sub({
        street: s(200),
        city: s(100),
        state: s(100),
        country: s(100),
        pincode: { ...s(6), match: [PINCODE_REGEX, 'Invalid pincode'] },
      }),
    }),

    // Practice fields editable by the verified doctor after approval.
    consultationFee: { type: Number, min: 0, max: 100000, default: null },
    bio: s(1000),
    languages: { type: [String], default: [] },
    consultationModes: { type: [String], enum: ['IN_PERSON', 'VIDEO', 'AUDIO'], default: ['IN_PERSON'] },
    isAcceptingPatients: { type: Boolean, default: true },

    // Backend-managed verification & publication metadata.
    primaryClinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', default: null },
    clinicIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'Clinic', default: [] },
    professionalVerificationStatus: { type: String, enum: ['VERIFIED'], default: 'VERIFIED' },
    profileStatus: { type: String, enum: ['DRAFT', 'PUBLISHED', 'SUSPENDED'], default: 'PUBLISHED' },
    isVerified: { type: Boolean, default: true },
    approvedAt: { type: Date, required: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    suspensionReason: s(500),
    suspendedAt: Date,
    suspendedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

doctorSchema.index({ profileStatus: 1, isAcceptingPatients: 1, 'professionalDetails.specialization': 1 });
doctorSchema.index({ consultationFee: 1, 'professionalDetails.experience': -1 });
doctorSchema.index({ 'clinicDetails.address.city': 1, 'clinicDetails.address.state': 1 });
doctorSchema.index({ 'professionalDetails.medicalSystem': 1 });

export const Doctor = mongoose.models.Doctor ?? mongoose.model('Doctor', doctorSchema);
