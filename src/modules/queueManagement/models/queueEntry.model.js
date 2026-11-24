import mongoose from 'mongoose';

export const QUEUE_ENTRY_STATUS = Object.freeze({
  WAITING: 'WAITING',
  CALLED: 'CALLED',
  IN_CONSULTATION: 'IN_CONSULTATION',
  COMPLETED: 'COMPLETED',
  SKIPPED: 'SKIPPED',
  CANCELLED: 'CANCELLED',
});

const queueEntrySchema = new mongoose.Schema(
  {
    queueSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'QueueSession', required: true },
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true, unique: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tokenNumber: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: Object.values(QUEUE_ENTRY_STATUS),
      default: QUEUE_ENTRY_STATUS.WAITING,
    },
    checkedInAt: { type: Date, default: Date.now },
    calledAt: { type: Date, default: null },
    consultationStartedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

queueEntrySchema.index({ queueSessionId: 1, tokenNumber: 1 }, { unique: true });
queueEntrySchema.index({ queueSessionId: 1, status: 1, tokenNumber: 1 });
queueEntrySchema.index({ patientId: 1, checkedInAt: -1 });

export const QueueEntry = mongoose.models.QueueEntry ?? mongoose.model('QueueEntry', queueEntrySchema);
