import mongoose from 'mongoose';

const calendlyWebhookEventSchema = new mongoose.Schema(
  {
    provider: { type: String, default: 'CALENDLY' },
    dedupKey: { type: String, required: true, unique: true },
    eventType: { type: String, required: true },
    inviteeUri: { type: String, trim: true },
    scheduledEventUri: { type: String, trim: true },
    receivedAt: { type: Date, default: Date.now },
    processingStatus: {
      type: String,
      enum: ['RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED'],
      default: 'RECEIVED',
    },
    processingResult: { type: String, trim: true, maxlength: 500 },
    errorDetails: { type: String, trim: true, maxlength: 1000 },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

calendlyWebhookEventSchema.index({ inviteeUri: 1, eventType: 1 });
calendlyWebhookEventSchema.index({ processingStatus: 1, receivedAt: -1 });

export const CalendlyWebhookEvent =
  mongoose.models.CalendlyWebhookEvent ??
  mongoose.model('CalendlyWebhookEvent', calendlyWebhookEventSchema);
