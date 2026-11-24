import mongoose from 'mongoose';

const abdmWebhookEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, trim: true, required: true, unique: true, index: true },
    requestId: { type: String, trim: true, required: true, index: true },
    eventType: { type: String, trim: true, required: true },
    timestamp: { type: Date, required: true },
    processingStatus: {
      type: String,
      enum: ['RECEIVED', 'PROCESSED', 'FAILED', 'IGNORED'],
      default: 'RECEIVED',
    },
    errorMessage: { type: String, trim: true, default: null },
  },
  { timestamps: true }
);

export const AbdmWebhookEvent =
  mongoose.models.AbdmWebhookEvent || mongoose.model('AbdmWebhookEvent', abdmWebhookEventSchema);
