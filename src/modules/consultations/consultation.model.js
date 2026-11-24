import mongoose from 'mongoose';

export const CONSULTATION_STATUS = Object.freeze({
  SCHEDULED: 'SCHEDULED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
});

const consultationSchema = new mongoose.Schema(
  {
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      required: true,
      unique: true,
      immutable: true,
    },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', default: null },
    consultationDate: { type: Date, required: true },
    notes: { type: String, trim: true, maxlength: 4000, default: '' },
    followUpInstructions: { type: String, trim: true, maxlength: 1000, default: '' },
    prescriptionIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'Prescription', default: [] },
    status: {
      type: String,
      enum: Object.values(CONSULTATION_STATUS),
      default: CONSULTATION_STATUS.IN_PROGRESS,
    },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

consultationSchema.index({ patientId: 1, consultationDate: -1 });
consultationSchema.index({ doctorId: 1, consultationDate: -1 });

export const Consultation =
  mongoose.models.Consultation ?? mongoose.model('Consultation', consultationSchema);
