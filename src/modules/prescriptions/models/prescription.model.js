import mongoose from 'mongoose';
import { PRESCRIPTION_STATUS } from '../prescription.constants.js';

const s = (max) => ({ type: String, trim: true, maxlength: max });

const medicineSchema = new mongoose.Schema(
  {
    medicineName: { ...s(200), required: true },
    genericName: s(200),
    strength: s(100),
    dosageForm: s(100),
    dose: { ...s(100), required: true },
    route: s(100),
    frequency: { ...s(100), required: true },
    duration: { ...s(100), required: true },
    quantity: { type: Number, min: 1, max: 10000 },
    instructions: s(500),
  },
  { _id: false }
);

const prescriptionSchema = new mongoose.Schema(
  {
    prescriptionNumber: { type: String, trim: true, unique: true, sparse: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true },
    clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', default: null },
    diagnosis: s(500),
    clinicalNotes: s(2000),
    medicines: { type: [medicineSchema], default: [] },
    generalInstructions: s(1000),
    status: {
      type: String,
      enum: Object.values(PRESCRIPTION_STATUS),
      default: PRESCRIPTION_STATUS.DRAFT,
    },
    issuedAt: { type: Date, default: null },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    previousPrescriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Prescription', default: null },
    amendmentReason: s(500),
    voidReason: s(500),
    voidedAt: { type: Date, default: null },
    version: { type: Number, default: 1, min: 1 },
    doctorAttestation: {
      doctorName: s(120),
      qualification: s(200),
      registrationNumberReference: s(50),
      attestedAt: Date,
    },
  },
  { timestamps: true }
);

prescriptionSchema.index({ patientId: 1, issuedAt: -1 });
prescriptionSchema.index({ doctorId: 1, createdAt: -1 });
prescriptionSchema.index({ appointmentId: 1 });
prescriptionSchema.index({ status: 1 });

export const Prescription =
  mongoose.models.Prescription ?? mongoose.model('Prescription', prescriptionSchema);
