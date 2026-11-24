import mongoose from 'mongoose';

const supportMessageSchema = new mongoose.Schema(
  {
    ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'SupportTicket', required: true, index: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    senderRole: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    isInternalNote: { type: Boolean, default: false },
  },
  { timestamps: true }
);

supportMessageSchema.index({ ticketId: 1, createdAt: 1 });

export const SupportMessage =
  mongoose.models.SupportMessage || mongoose.model('SupportMessage', supportMessageSchema);
