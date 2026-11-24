import mongoose from 'mongoose';

export const WAITLIST_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  OFFERED: 'OFFERED',
  BOOKED: 'BOOKED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
});

const waitlistSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', default: null },
    appointmentTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'AppointmentType', required: true },
    preferredDate: { type: Date, required: true },
    preferredTimeRange: {
      start: { type: String, trim: true, default: '00:00' },
      end: { type: String, trim: true, default: '23:59' },
    },
    timezone: { type: String, trim: true, default: 'UTC' },
    consultationMode: { type: String, enum: ['IN_PERSON', 'VIDEO', 'AUDIO'], default: 'IN_PERSON' },
    status: {
      type: String,
      enum: Object.values(WAITLIST_STATUS),
      default: WAITLIST_STATUS.ACTIVE,
    },
  },
  { timestamps: true }
);

waitlistSchema.index({ doctorId: 1, appointmentTypeId: 1, status: 1, createdAt: 1 });
waitlistSchema.index({ patientId: 1, status: 1 });

export const Waitlist = mongoose.models.Waitlist ?? mongoose.model('Waitlist', waitlistSchema);
