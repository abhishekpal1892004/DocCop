import mongoose from 'mongoose';
import { ASSOCIATION_VERIFICATION_STATUS, CLINIC_RELATIONSHIP_TYPES } from './clinic.constants.js';

const doctorClinicAssociationSchema = new mongoose.Schema(
  {
    doctorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'DoctorApplication', default: null },
    doctorProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', default: null },
    clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', required: true },
    relationshipType: {
      type: String,
      enum: CLINIC_RELATIONSHIP_TYPES,
      required: true,
    },
    affiliationDocumentId: { type: String, trim: true, maxlength: 100 },
    verificationStatus: {
      type: String,
      enum: Object.values(ASSOCIATION_VERIFICATION_STATUS),
      default: ASSOCIATION_VERIFICATION_STATUS.PENDING,
    },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    verifiedAt: Date,
    remarks: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

doctorClinicAssociationSchema.index({ doctorUserId: 1, clinicId: 1 }, { unique: true });
doctorClinicAssociationSchema.index({ clinicId: 1, verificationStatus: 1 });

export const DoctorClinicAssociation =
  mongoose.models.DoctorClinicAssociation ??
  mongoose.model('DoctorClinicAssociation', doctorClinicAssociationSchema);
