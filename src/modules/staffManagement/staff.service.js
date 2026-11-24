import crypto from 'node:crypto';
import { ApiError } from '../../utils/ApiError.js';
import { clinicRepository } from '../clinics/clinic.repository.js';
import { organizationRepository } from '../organizations/organization.repository.js';
import { ACCOUNT_STATUS, ONBOARDING_STATUS, ROLES } from '../users/user.constants.js';
import { userRepository } from '../users/user.repository.js';
import { clerkGateway } from '../../integrations/clerk/clerk.gateway.js';
import { mapClerkUser } from '../../integrations/clerk/clerk.mapper.js';
import { INVITATION_STATUS } from './staffInvitation.model.js';
import { staffRepository } from './staff.repository.js';

const DEFAULT_PERMISSIONS = Object.freeze({
  CLINIC_MANAGER: [
    'CLINIC_VIEW',
    'CLINIC_UPDATE',
    'APPOINTMENT_VIEW',
    'QUEUE_MANAGE',
    'PATIENT_CHECK_IN',
    'STAFF_INVITE',
    'CLINIC_ANALYTICS_VIEW',
  ],
  RECEPTIONIST: ['CLINIC_VIEW', 'APPOINTMENT_VIEW', 'QUEUE_MANAGE', 'PATIENT_CHECK_IN'],
});

const hashToken = (token) => crypto.createHash('sha256').update(String(token), 'utf8').digest('hex');

const assertCanManageClinicStaff = async (user, clinicId) => {
  const clinic = await clinicRepository.findById(clinicId);
  if (!clinic) throw new ApiError(404, 'Clinic not found', 'CLINIC_NOT_FOUND');

  if (user.role === ROLES.ADMIN) return clinic;

  if (clinic.organizationId) {
    const org = await organizationRepository.findById(clinic.organizationId);
    if (org && String(org.ownerUserId) === String(user._id)) return clinic;
  }

  if (user.role === ROLES.CLINIC_MANAGER) {
    const membership = await staffRepository.findActiveMembershipByUserId(user._id);
    if (membership && membership.clinicIds.some((cid) => String(cid) === String(clinic._id))) {
      return clinic;
    }
  }

  throw new ApiError(403, 'You are not authorized to manage staff for this clinic', 'FORBIDDEN');
};

export const inviteStaffMember = async (user, clinicId, input) => {
  const clinic = await assertCanManageClinicStaff(user, clinicId);
  const email = input.email.toLowerCase();

  const existingPending = await staffRepository.findPendingInvitationByEmailAndClinic(email, clinic._id);
  if (existingPending) {
    throw new ApiError(409, 'A pending staff invitation already exists for this email and clinic', 'INVITATION_EXISTS');
  }

  const rawToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + (input.expiresInHours ?? 48) * 3600_000);

  const invitation = await staffRepository.createInvitation({
    email,
    organizationId: clinic.organizationId ?? null,
    clinicIds: [clinic._id],
    role: input.role,
    permissions: input.permissions?.length ? input.permissions : DEFAULT_PERMISSIONS[input.role],
    tokenHash,
    invitationStatus: INVITATION_STATUS.PENDING,
    invitedBy: user._id,
    expiresAt,
  });

  return {
    invitation: {
      id: String(invitation._id),
      email: invitation.email,
      clinicIds: invitation.clinicIds.map(String),
      role: invitation.role,
      permissions: invitation.permissions,
      invitationStatus: invitation.invitationStatus,
      expiresAt: invitation.expiresAt,
    },
    invitationToken: rawToken,
  };
};

export const acceptStaffInvitation = async (identity, { token }) => {
  const tokenHash = hashToken(token);
  const invitation = await staffRepository.findInvitationByTokenHash(tokenHash);
  if (!invitation) {
    throw new ApiError(404, 'Staff invitation not found', 'INVALID_INVITATION_TOKEN');
  }
  if (invitation.invitationStatus === INVITATION_STATUS.REVOKED) {
    throw new ApiError(409, 'This staff invitation has been revoked', 'INVITATION_REVOKED');
  }
  if (invitation.invitationStatus === INVITATION_STATUS.ACCEPTED) {
    throw new ApiError(409, 'This staff invitation has already been accepted', 'INVITATION_ALREADY_ACCEPTED');
  }
  if (invitation.invitationStatus === INVITATION_STATUS.EXPIRED || new Date(invitation.expiresAt) <= new Date()) {
    await staffRepository.updateInvitationById(invitation._id, { invitationStatus: INVITATION_STATUS.EXPIRED });
    throw new ApiError(410, 'This staff invitation has expired', 'INVITATION_EXPIRED');
  }

  let user = await userRepository.findByClerkUserId(identity.clerkUserId);
  if (!user) {
    const clerkIdentity = mapClerkUser(await clerkGateway.getUser(identity.clerkUserId));
    if (!clerkIdentity.email || clerkIdentity.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new ApiError(403, 'Invitation email does not match your authenticated account', 'EMAIL_MISMATCH');
    }
    user = await userRepository.create({
      ...clerkIdentity,
      clerkUserId: identity.clerkUserId,
      fullName: [clerkIdentity.firstName, clerkIdentity.lastName].filter(Boolean).join(' ') || undefined,
      role: invitation.role,
      accountStatus: ACCOUNT_STATUS.ACTIVE,
      onboardingStatus: ONBOARDING_STATUS.COMPLETED,
      lastLoginAt: new Date(),
    });
  } else if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
    throw new ApiError(403, 'Invitation email does not match your authenticated account', 'EMAIL_MISMATCH');
  }

  const consumed = await staffRepository.consumePendingInvitation(invitation._id, user._id, new Date());
  if (!consumed) {
    throw new ApiError(409, 'Invitation could not be accepted (already used or expired)', 'INVITATION_CONFLICT');
  }

  const existingMembership = await staffRepository.findActiveMembershipByUserId(user._id);
  let membership;
  if (existingMembership) {
    const mergedClinics = [
      ...new Set([...existingMembership.clinicIds.map(String), ...invitation.clinicIds.map(String)]),
    ];
    membership = await staffRepository.updateMembershipById(existingMembership._id, {
      clinicIds: mergedClinics,
      role: invitation.role,
      permissions: invitation.permissions,
    });
  } else {
    membership = await staffRepository.createMembership({
      userId: user._id,
      organizationId: invitation.organizationId,
      clinicIds: invitation.clinicIds,
      role: invitation.role,
      permissions: invitation.permissions,
      status: 'ACTIVE',
      invitedBy: invitation.invitedBy,
    });
  }

  return {
    membership: {
      id: String(membership._id),
      userId: String(membership.userId),
      organizationId: membership.organizationId ? String(membership.organizationId) : null,
      clinicIds: membership.clinicIds.map(String),
      role: membership.role,
      permissions: membership.permissions,
      status: membership.status,
    },
  };
};

export const listClinicStaff = async (user, clinicId) => {
  await assertCanManageClinicStaff(user, clinicId);
  const memberships = await staffRepository.findActiveMembershipsByClinicId(clinicId);
  return memberships.map((m) => ({
    id: String(m._id),
    userId: String(m.userId),
    clinicIds: m.clinicIds.map(String),
    role: m.role,
    permissions: m.permissions,
    status: m.status,
  }));
};

export const updateStaffPermissions = async (user, membershipId, { permissions }) => {
  const membership = await staffRepository.findMembershipById(membershipId);
  if (!membership || membership.status !== 'ACTIVE') {
    throw new ApiError(404, 'Staff membership not found', 'MEMBERSHIP_NOT_FOUND');
  }
  const firstClinicId = membership.clinicIds[0];
  if (firstClinicId) {
    await assertCanManageClinicStaff(user, firstClinicId);
  } else if (user.role !== ROLES.ADMIN) {
    throw new ApiError(403, 'Not authorized', 'FORBIDDEN');
  }

  const updated = await staffRepository.updateMembershipById(membershipId, { permissions });
  return {
    id: String(updated._id),
    userId: String(updated.userId),
    clinicIds: updated.clinicIds.map(String),
    role: updated.role,
    permissions: updated.permissions,
  };
};

export const removeStaffFromClinic = async (user, clinicId, targetUserId) => {
  await assertCanManageClinicStaff(user, clinicId);
  const membership = await staffRepository.findActiveMembershipByUserId(targetUserId);
  if (!membership || !membership.clinicIds.some((c) => String(c) === String(clinicId))) {
    throw new ApiError(404, 'Staff membership not found for this clinic', 'MEMBERSHIP_NOT_FOUND');
  }

  const remaining = membership.clinicIds.filter((c) => String(c) !== String(clinicId));
  await staffRepository.updateMembershipById(membership._id, {
    clinicIds: remaining,
    ...(remaining.length === 0 ? { status: 'REVOKED' } : {}),
  });

  return { removed: true, clinicId: String(clinicId), userId: String(targetUserId) };
};
