import mongoose from 'mongoose';
import { E164_REGEX } from '../patients/patient.constants.js';
import {
  APPLICATION_STATUS,
  CLINIC_RELATIONSHIPS,
  CLINIC_TYPES,
  GST_VERIFICATION_STATUS,
  MEDICAL_SYSTEMS,
  NMC_VERIFICATION_STATUS,
  PINCODE_REGEX,
} from './doctorApplication.constants.js';

const s = (max) => ({ type: String, trim: true, maxlength: max });
const sub = (def) => ({ type: new mongoose.Schema(def, { _id: false }), default: () => ({}) });

const doctorApplicationSchema = new mongoose.Schema(
  {
    // One application per doctor; ownership comes from the authenticated MongoDB user.
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, immutable: true },

    personalDetails: sub({
      fullName: s(120),
      phoneNumber: { ...s(16), match: [E164_REGEX, 'Phone number must be in E.164 format'] },
      email: { ...s(254), lowercase: true }, // from the verified identity, not editable
      profileImage: s(2048), // from the verified identity, not editable
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
      // Certificate upload is deferred (no storage backend yet); never set from client input.
      certificateDocumentId: s(100),
    }),

    clinicDetails: sub({
      clinicName: s(200),
      clinicType: { type: String, enum: CLINIC_TYPES },
      relationship: { type: String, enum: CLINIC_RELATIONSHIPS },
      // Stored for future manual verification only; never auto-verified.
      clinicRegistrationNumber: s(50),
      registrationAuthority: s(150),
      address: sub({
        street: s(200),
        city: s(100),
        state: s(100),
        country: s(100),
        pincode: { ...s(6), match: [PINCODE_REGEX, 'Invalid pincode'] },
      }),
    }),

    gstDetails: sub({
      isGSTRegistered: Boolean,
      gstin: { ...s(15), uppercase: true },
      legalBusinessName: s(200),
      // Backend-managed. A well-formed GSTIN is NOT a verified registration.
      verificationStatus: { type: String, enum: Object.values(GST_VERIFICATION_STATUS), default: GST_VERIFICATION_STATUS.NOT_PROVIDED },
    }),

    // Backend-managed only.
    applicationStatus: { type: String, enum: Object.values(APPLICATION_STATUS), default: APPLICATION_STATUS.DRAFT },
    nmcVerificationStatus: { type: String, enum: Object.values(NMC_VERIFICATION_STATUS), default: NMC_VERIFICATION_STATUS.NOT_CHECKED },
    latestNmcLookupId: { type: mongoose.Schema.Types.ObjectId, ref: 'NmcLookup', default: null },
    nmcCheckedAt: Date,
    submittedAt: Date,
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: Date,
    reviewNotes: s(1000),
    rejectionReason: s(500),
    requestedChanges: s(1000),
    fieldsToCorrect: { type: [String], default: [] },
  },
  { timestamps: true }
);

// userId unique index comes from `unique: true`.
doctorApplicationSchema.index({ applicationStatus: 1, submittedAt: 1 }); // future admin review queue
doctorApplicationSchema.index({ 'medicalRegistration.stateCode': 1, 'medicalRegistration.registrationNumber': 1 }); // future duplicate-registration checks

export const DoctorApplication =
  mongoose.models.DoctorApplication ?? mongoose.model('DoctorApplication', doctorApplicationSchema);
