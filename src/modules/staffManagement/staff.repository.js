import { INVITATION_STATUS, StaffInvitation } from './staffInvitation.model.js';
import { StaffMembership } from './staffMembership.model.js';

export const staffRepository = {
  async createInvitation(data) {
    const doc = await StaffInvitation.create(data);
    return doc.toObject();
  },

  findPendingInvitationByEmailAndClinic: (email, clinicId) =>
    StaffInvitation.findOne({
      email: email.toLowerCase(),
      clinicIds: clinicId,
      invitationStatus: INVITATION_STATUS.PENDING,
      expiresAt: { $gt: new Date() },
    }).lean(),

  findInvitationByTokenHash: (tokenHash) => StaffInvitation.findOne({ tokenHash }).lean(),

  consumePendingInvitation: (id, userId, now = new Date()) =>
    StaffInvitation.findOneAndUpdate(
      { _id: id, invitationStatus: INVITATION_STATUS.PENDING, expiresAt: { $gt: now } },
      { $set: { invitationStatus: INVITATION_STATUS.ACCEPTED, acceptedByUserId: userId, acceptedAt: now } },
      { new: true }
    ).lean(),

  updateInvitationById: (id, set) =>
    StaffInvitation.findByIdAndUpdate(id, { $set: set }, { new: true }).lean(),

  // Memberships
  async createMembership(data) {
    const doc = await StaffMembership.create(data);
    return doc.toObject();
  },

  findMembershipById: (id) => StaffMembership.findById(id).lean(),

  findActiveMembershipByUserId: (userId) =>
    StaffMembership.findOne({ userId, status: 'ACTIVE' }).lean(),

  findActiveMembershipsByClinicId: (clinicId) =>
    StaffMembership.find({ clinicIds: clinicId, status: 'ACTIVE' }).lean(),

  updateMembershipById: (id, set) =>
    StaffMembership.findByIdAndUpdate(id, { $set: set }, { new: true, runValidators: true }).lean(),
};
