import mongoose from 'mongoose';
import { PAYMENT_STATUS } from './payment.constants.js';

const paymentSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true },
    razorpayOrderId: { type: String, trim: true, unique: true, sparse: true },
    razorpayPaymentId: { type: String, trim: true, unique: true, sparse: true },
    refundId: { type: String, trim: true, sparse: true },
    // Stored in integer paise to avoid floating-point precision issues.
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR', uppercase: true, maxlength: 8 },
    status: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.CREATED,
    },
    signatureVerified: { type: Boolean, default: false },
    capturedAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    failureReason: { type: String, trim: true, maxlength: 500 },
    refundAmount: { type: Number, default: 0, min: 0 },
    refundReason: { type: String, trim: true, maxlength: 500 },
    refundedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

paymentSchema.index({ patientId: 1, createdAt: -1 });
paymentSchema.index({ appointmentId: 1 });

export const Payment = mongoose.models.Payment ?? mongoose.model('Payment', paymentSchema);
