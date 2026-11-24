import mongoose from 'mongoose';
import { REVIEW_MODERATION_STATUS } from './review.constants.js';

const reviewSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    reviewText: { type: String, trim: true, maxlength: 1500, default: '' },
    moderationStatus: {
      type: String,
      enum: Object.values(REVIEW_MODERATION_STATUS),
      default: REVIEW_MODERATION_STATUS.APPROVED,
    },
    isVerifiedAppointment: { type: Boolean, default: true },
    reportedCount: { type: Number, default: 0, min: 0 },
    moderationRemarks: { type: String, trim: true, maxlength: 500 },
    moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    moderatedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

reviewSchema.index({ patientId: 1, appointmentId: 1 }, { unique: true });
reviewSchema.index({ doctorId: 1, moderationStatus: 1, createdAt: -1 });

export const Review = mongoose.models.Review ?? mongoose.model('Review', reviewSchema);
