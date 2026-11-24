import { ApiError } from '../../utils/ApiError.js';
import { CLINIC_VERIFICATION_STATUS } from '../clinics/clinic.constants.js';
import { clinicRepository } from '../clinics/clinic.repository.js';
import { toPublicClinic } from '../clinics/clinic.service.js';
import { ROLES } from '../users/user.constants.js';
import { ORGANIZATION_STATUS } from './organization.model.js';
import { organizationRepository } from './organization.repository.js';

export const toPublicOrganization = (org) => ({
  id: String(org._id),
  name: org.name,
  legalName: org.legalName ?? null,
  organizationType: org.organizationType,
  ownerUserId: String(org.ownerUserId),
  contactEmail: org.contactEmail ?? null,
  contactPhone: org.contactPhone ?? null,
  status: org.status,
  createdAt: org.createdAt,
  updatedAt: org.updatedAt,
});

export const createOrganization = async (user, input) => {
  const existing = await organizationRepository.findByOwnerUserId(user._id);
  if (existing) {
    throw new ApiError(409, 'You already own an organization', 'ORGANIZATION_EXISTS');
  }

  const created = await organizationRepository.create({
    ...input,
    ownerUserId: user._id,
    contactEmail: input.contactEmail ?? user.email,
    status: ORGANIZATION_STATUS.ACTIVE,
  });

  return toPublicOrganization(created);
};

export const getMyOrganization = async (user) => {
  const org = await organizationRepository.findByOwnerUserId(user._id);
  if (!org) throw new ApiError(404, 'Organization not found', 'ORGANIZATION_NOT_FOUND');
  return toPublicOrganization(org);
};

export const updateMyOrganization = async (user, input) => {
  const updated = await organizationRepository.updateByOwnerUserId(user._id, input);
  if (!updated) throw new ApiError(404, 'Organization not found', 'ORGANIZATION_NOT_FOUND');
  return toPublicOrganization(updated);
};

const assertOrganizationAccess = async (user, orgId) => {
  const org = await organizationRepository.findById(orgId);
  if (!org) throw new ApiError(404, 'Organization not found', 'ORGANIZATION_NOT_FOUND');
  if (user.role !== ROLES.ADMIN && String(org.ownerUserId) !== String(user._id)) {
    throw new ApiError(403, 'You are not authorized to access this organization', 'FORBIDDEN');
  }
  return org;
};

export const addClinicToOrganization = async (user, orgId, input) => {
  const org = await assertOrganizationAccess(user, orgId);
  if (org.status === ORGANIZATION_STATUS.SUSPENDED) {
    throw new ApiError(403, 'Cannot add clinics to a suspended organization', 'ORGANIZATION_SUSPENDED');
  }

  const clinic = await clinicRepository.create({
    organizationId: org._id,
    clinicName: input.clinicName,
    clinicType: input.clinicType,
    registrationNumber: input.registrationNumber,
    registrationAuthority: input.registrationAuthority,
    contactNumber: input.contactNumber,
    address: input.address,
    verificationStatus: CLINIC_VERIFICATION_STATUS.PENDING,
  });

  return toPublicClinic(clinic);
};

export const listOrganizationClinics = async (user, orgId) => {
  const org = await assertOrganizationAccess(user, orgId);
  const clinics = await clinicRepository.findByOrganizationId(org._id);
  return clinics.map(toPublicClinic);
};
