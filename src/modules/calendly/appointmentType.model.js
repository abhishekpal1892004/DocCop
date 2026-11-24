import mongoose from 'mongoose';
import { CONSULTATION_MODES } from './calendly.constants.js';

const appointmentTypeSchema = new mongoose.Schema(
  {
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    calendlyEventTypeUri: { type: String, trim: true, required: true },
    name: { type: String, trim: true, required: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    durationMinutes: { type: Number, required: true, min: 5, max: 480 },
    consultationFee: { type: Number, required: true, min: 0, max: 100000 },
    consultationMode: { type: String, enum: CONSULTATION_MODES, default: 'IN_PERSON' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

appointmentTypeSchema.index({ doctorId: 1, calendlyEventTypeUri: 1 }, { unique: true });
appointmentTypeSchema.index({ doctorId: 1, isActive: 1 });

export const AppointmentType =
  mongoose.models.AppointmentType ?? mongoose.model('AppointmentType', appointmentTypeSchema);
