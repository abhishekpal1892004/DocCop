import mongoose from 'mongoose';

export const FOLLOW_UP_TYPES = Object.freeze([
  'ROUTINE',
  'POST_CONSULTATION',
  'DOCTOR_REQUESTED',
  'OTHER',
]);

export const FOLLOW_UP_STATUS = Object.freeze({
  PENDING: 'PENDING',
  SCHEDULED: 'SCHEDULED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
});

const followUpSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true },
    recommendedDate: { type: Date, required: true },
    reason: { type: String, trim: true, maxlength: 500, default: '' },
    followUpType: { type: String, enum: FOLLOW_UP_TYPES, default: 'ROUTINE' },
    status: {
      type: String,
      enum: Object.values(FOLLOW_UP_STATUS),
      default: FOLLOW_UP_STATUS.PENDING,
    },
    bookedAppointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

followUpSchema.index({ patientId: 1, status: 1, recommendedDate: 1 });
followUpSchema.index({ doctorId: 1, createdAt: -1 });

export const FollowUp = mongoose.models.FollowUp ?? mongoose.model('FollowUp', followUpSchema);
