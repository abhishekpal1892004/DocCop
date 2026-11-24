import mongoose from 'mongoose';

export const TICKET_CATEGORIES = Object.freeze([
  'APPOINTMENT',
  'PAYMENT',
  'DOCTOR_COMPLAINT',
  'CLINIC_COMPLAINT',
  'TECHNICAL',
  'OTHER',
]);

export const TICKET_PRIORITIES = Object.freeze(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);

export const TICKET_STATUSES = Object.freeze([
  'OPEN',
  'IN_PROGRESS',
  'WAITING_FOR_USER',
  'RESOLVED',
  'CLOSED',
]);

const supportSequenceSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { versionKey: false }
);

export const SupportSequence =
  mongoose.models.SupportSequence || mongoose.model('SupportSequence', supportSequenceSchema);

const supportTicketSchema = new mongoose.Schema(
  {
    ticketNumber: { type: String, required: true, unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userRole: { type: String, required: true, trim: true },
    category: { type: String, enum: TICKET_CATEGORIES, required: true },
    priority: { type: String, enum: TICKET_PRIORITIES, default: 'MEDIUM' },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, trim: true, maxlength: 4000 },
    relatedAppointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
    relatedDoctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', default: null },
    relatedClinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', default: null },
    status: { type: String, enum: TICKET_STATUSES, default: 'OPEN', index: true },
    assignedAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolutionNotes: { type: String, trim: true, maxlength: 2000, default: '' },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

supportTicketSchema.index({ userId: 1, createdAt: -1 });
supportTicketSchema.index({ status: 1, priority: 1, createdAt: -1 });

export const SupportTicket =
  mongoose.models.SupportTicket || mongoose.model('SupportTicket', supportTicketSchema);
