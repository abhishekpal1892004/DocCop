import mongoose from 'mongoose';

export const STAFF_ROLES = Object.freeze(['CLINIC_MANAGER', 'RECEPTIONIST']);

export const STAFF_PERMISSIONS = Object.freeze([
  'CLINIC_VIEW',
  'CLINIC_UPDATE',
  'APPOINTMENT_VIEW',
  'QUEUE_MANAGE',
  'PATIENT_CHECK_IN',
  'STAFF_INVITE',
  'CLINIC_ANALYTICS_VIEW',
]);

export const INVITATION_STATUS = Object.freeze({
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  EXPIRED: 'EXPIRED',
  REVOKED: 'REVOKED',
});

const staffInvitationSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null },
    clinicIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'Clinic', required: true },
    role: { type: String, enum: STAFF_ROLES, required: true },
    permissions: { type: [String], enum: STAFF_PERMISSIONS, default: [] },
    tokenHash: { type: String, required: true, unique: true },
    invitationStatus: {
      type: String,
      enum: Object.values(INVITATION_STATUS),
      default: INVITATION_STATUS.PENDING,
    },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true },
    acceptedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    acceptedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

staffInvitationSchema.index({ email: 1, invitationStatus: 1 });
staffInvitationSchema.index({ expiresAt: 1 });

export const StaffInvitation =
  mongoose.models.StaffInvitation ?? mongoose.model('StaffInvitation', staffInvitationSchema);
