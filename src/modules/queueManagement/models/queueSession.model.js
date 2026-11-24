import mongoose from 'mongoose';

export const QUEUE_SESSION_STATUS = Object.freeze({
  OPEN: 'OPEN',
  PAUSED: 'PAUSED',
  CLOSED: 'CLOSED',
});

const queueSessionSchema = new mongoose.Schema(
  {
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', default: null },
    dateKey: { type: String, required: true, trim: true }, // YYYY-MM-DD
    date: { type: Date, required: true },
    status: {
      type: String,
      enum: Object.values(QUEUE_SESSION_STATUS),
      default: QUEUE_SESSION_STATUS.OPEN,
    },
    currentTokenNumber: { type: Number, default: 0, min: 0 },
    nextTokenSequence: { type: Number, default: 0, min: 0 },
    averageConsultationMinutes: { type: Number, default: 15, min: 5, max: 120 },
    openedAt: { type: Date, default: Date.now },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

queueSessionSchema.index({ doctorId: 1, dateKey: 1 }, { unique: true });

export const QueueSession =
  mongoose.models.QueueSession ?? mongoose.model('QueueSession', queueSessionSchema);
