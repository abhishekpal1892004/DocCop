import mongoose from 'mongoose';
import { STAFF_PERMISSIONS, STAFF_ROLES } from './staffInvitation.model.js';

const staffMembershipSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null },
    clinicIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'Clinic', default: [] },
    role: { type: String, enum: STAFF_ROLES, required: true },
    permissions: { type: [String], enum: STAFF_PERMISSIONS, default: [] },
    status: { type: String, enum: ['ACTIVE', 'REVOKED'], default: 'ACTIVE' },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

staffMembershipSchema.index({ userId: 1, status: 1 });
staffMembershipSchema.index({ clinicIds: 1, status: 1 });

export const StaffMembership =
  mongoose.models.StaffMembership ?? mongoose.model('StaffMembership', staffMembershipSchema);
