import mongoose from 'mongoose';
import {
  CLINIC_VERIFICATION_TRACK_STATUS,
  GST_VERIFICATION_TRACK_STATUS,
  PROFESSIONAL_VERIFICATION_STATUS,
  VERIFICATION_METHODS,
} from './verification.constants.js';

const s = (max) => ({ type: String, trim: true, maxlength: max });

const doctorVerificationSchema = new mongoose.Schema(
  {
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DoctorApplication',
      required: true,
      unique: true,
      immutable: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      immutable: true,
    },

    professional: {
      status: {
        type: String,
        enum: Object.values(PROFESSIONAL_VERIFICATION_STATUS),
        default: PROFESSIONAL_VERIFICATION_STATUS.PENDING,
      },
      verificationMethod: { type: String, enum: VERIFICATION_METHODS },
      officialSource: s(200),
      registrationNumberChecked: s(50),
      checkedAt: Date,
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      remarks: s(1000),
    },

    clinic: {
      status: {
        type: String,
        enum: Object.values(CLINIC_VERIFICATION_TRACK_STATUS),
        default: CLINIC_VERIFICATION_TRACK_STATUS.PENDING,
      },
      clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', default: null },
      clinicName: s(200),
      registrationNumberChecked: s(50),
      checkedAt: Date,
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      remarks: s(1000),
    },

    gst: {
      status: {
        type: String,
        enum: Object.values(GST_VERIFICATION_TRACK_STATUS),
        default: GST_VERIFICATION_TRACK_STATUS.NOT_PROVIDED,
      },
      gstin: { ...s(15), uppercase: true },
      legalBusinessName: s(200),
      tradeName: s(200),
      state: s(100),
      principalPlaceOfBusiness: s(300),
      registrationStatus: s(100),
      registrationEffectiveDate: Date,
      verificationSource: s(200),
      checkedAt: Date,
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      remarks: s(1000),
    },
  },
  { timestamps: true }
);

export const DoctorVerification =
  mongoose.models.DoctorVerification ?? mongoose.model('DoctorVerification', doctorVerificationSchema);
