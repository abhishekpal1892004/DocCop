import mongoose from 'mongoose';

export const VIDEO_CONSULTATION_STATUS = Object.freeze({
  SCHEDULED: 'SCHEDULED',
  READY: 'READY',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
});

const videoConsultationSchema = new mongoose.Schema(
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
    channelName: { type: String, required: true, unique: true, immutable: true },
    status: {
      type: String,
      enum: Object.values(VIDEO_CONSULTATION_STATUS),
      default: VIDEO_CONSULTATION_STATUS.READY,
    },
    scheduledAt: { type: Date, required: true },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    roomExpiresAt: { type: Date, required: true },
    telemedicineConsent: {
      patientConsentedAt: { type: Date, default: null },
      doctorConfirmedAt: { type: Date, default: null },
      emergencyNoticeAcknowledged: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

videoConsultationSchema.index({ patientId: 1, scheduledAt: -1 });
videoConsultationSchema.index({ doctorId: 1, scheduledAt: -1 });

export const VideoConsultation =
  mongoose.models.VideoConsultation ?? mongoose.model('VideoConsultation', videoConsultationSchema);
