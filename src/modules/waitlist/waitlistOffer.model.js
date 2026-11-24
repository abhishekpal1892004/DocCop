import mongoose from 'mongoose';

export const WAITLIST_OFFER_STATUS = Object.freeze({
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
  EXPIRED: 'EXPIRED',
});

const waitlistOfferSchema = new mongoose.Schema(
  {
    waitlistId: { type: mongoose.Schema.Types.ObjectId, ref: 'Waitlist', required: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    appointmentTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'AppointmentType', required: true },
    offeredStartAt: { type: Date, required: true },
    timezone: { type: String, trim: true, default: 'UTC' },
    status: {
      type: String,
      enum: Object.values(WAITLIST_OFFER_STATUS),
      default: WAITLIST_OFFER_STATUS.PENDING,
    },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date, default: null },
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
  },
  { timestamps: true }
);

waitlistOfferSchema.index({ waitlistId: 1, offeredStartAt: 1 });
waitlistOfferSchema.index({ patientId: 1, status: 1 });

export const WaitlistOffer =
  mongoose.models.WaitlistOffer ?? mongoose.model('WaitlistOffer', waitlistOfferSchema);
