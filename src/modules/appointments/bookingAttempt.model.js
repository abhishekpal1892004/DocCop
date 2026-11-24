import mongoose from 'mongoose';
import { BOOKING_ATTEMPT_STATUS } from './appointment.constants.js';

const bookingAttemptSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    appointmentTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'AppointmentType', required: true },
    idempotencyKey: { type: String, trim: true, required: true },
    requestedStartAt: { type: Date, required: true },
    status: {
      type: String,
      enum: Object.values(BOOKING_ATTEMPT_STATUS),
      default: BOOKING_ATTEMPT_STATUS.PENDING_EXTERNAL,
    },
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

bookingAttemptSchema.index({ patientId: 1, idempotencyKey: 1 }, { unique: true });

export const BookingAttempt =
  mongoose.models.BookingAttempt ?? mongoose.model('BookingAttempt', bookingAttemptSchema);
