import mongoose from 'mongoose';
import { APPOINTMENT_PAYMENT_STATUS, APPOINTMENT_STATUS } from './appointment.constants.js';

const appointmentSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', default: null },
    appointmentTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'AppointmentType', required: true },
    provider: { type: String, enum: ['CALENDLY'], default: 'CALENDLY' },
    calendlyEventUri: { type: String, trim: true },
    calendlyInviteeUri: { type: String, trim: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    timezone: { type: String, trim: true, default: 'UTC' },
    status: {
      type: String,
      enum: Object.values(APPOINTMENT_STATUS),
      default: APPOINTMENT_STATUS.PENDING_PROVIDER,
    },
    cancelUrlEncrypted: { type: String },
    rescheduleUrlEncrypted: { type: String },
    cancellationReason: { type: String, trim: true, maxlength: 500 },
    rescheduledFromId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
    rescheduledToId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
    consultationMode: { type: String, enum: ['IN_PERSON', 'VIDEO', 'AUDIO'], default: 'IN_PERSON' },
    consultationFee: { type: Number, min: 0, default: 0 },
    paymentStatus: {
      type: String,
      enum: Object.values(APPOINTMENT_PAYMENT_STATUS),
      default: APPOINTMENT_PAYMENT_STATUS.NOT_REQUIRED,
    },
    paymentDeadlineAt: { type: Date, default: null },
  },
  { timestamps: true }
);

appointmentSchema.index({ patientId: 1, startAt: -1 });
appointmentSchema.index({ doctorId: 1, startAt: -1 });
appointmentSchema.index({ calendlyInviteeUri: 1 }, { unique: true, sparse: true });
appointmentSchema.index({ calendlyEventUri: 1 });

export const Appointment = mongoose.models.Appointment ?? mongoose.model('Appointment', appointmentSchema);
