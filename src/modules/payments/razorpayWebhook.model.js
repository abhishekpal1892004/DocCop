import mongoose from 'mongoose';

const razorpayWebhookEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true },
    eventType: { type: String, required: true },
    razorpayOrderId: { type: String, trim: true },
    razorpayPaymentId: { type: String, trim: true },
    processingStatus: {
      type: String,
      enum: ['RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED'],
      default: 'RECEIVED',
    },
    processingResult: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

export const RazorpayWebhookEvent =
  mongoose.models.RazorpayWebhookEvent ??
  mongoose.model('RazorpayWebhookEvent', razorpayWebhookEventSchema);
