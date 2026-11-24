import { ApiError } from '../../utils/ApiError.js';
import { AUDIT_ACTIONS, AUDIT_TARGET_TYPES } from '../auditLogs/auditLog.constants.js';
import { recordAuditEvent } from '../auditLogs/auditLog.service.js';
import { organizationRepository } from '../organizations/organization.repository.js';
import { ROLES } from '../users/user.constants.js';
import { ASSOCIATION_VERIFICATION_STATUS, CLINIC_VERIFICATION_STATUS } from './clinic.constants.js';
import { clinicRepository } from './clinic.repository.js';

export const toPublicClinic = (c) => ({
  id: String(c._id),
  organizationId: c.organizationId ? String(c.organizationId) : null,
  clinicName: c.clinicName,
  clinicType: c.clinicType,
  registrationNumber: c.registrationNumber ?? null,
  registrationAuthority: c.registrationAuthority ?? null,
  registrationType: c.registrationType ?? null,
  ownerName: c.ownerName ?? null,
  contactNumber: c.contactNumber ?? null,
  address: c.address ?? {},
  verificationStatus: c.verificationStatus,
  verifiedAt: c.verifiedAt ?? null,
  verificationRemarks: c.verificationRemarks ?? null,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
});

export const toPublicAssociation = (a) => ({
  id: String(a._id),
  doctorUserId: String(a.doctorUserId),
  applicationId: a.applicationId ? String(a.applicationId) : null,
  doctorProfileId: a.doctorProfileId ? String(a.doctorProfileId) : null,
  clinicId: String(a.clinicId),
  relationshipType: a.relationshipType,
  affiliationDocumentId: a.affiliationDocumentId ?? null,
  verificationStatus: a.verificationStatus,
  verifiedAt: a.verifiedAt ?? null,
  remarks: a.remarks ?? null,
  createdAt: a.createdAt,
});

/**
 * Called when a doctor application is submitted: creates or links a Clinic record
 * and creates a pending DoctorClinicAssociation. Never marks either as VERIFIED.
 */
export const syncClinicFromApplication = async (application) => {
  const cd = application.clinicDetails ?? {};
  if (!cd.clinicName) return { clinic: null, association: null };

  let clinic = await clinicRepository.findMatchingClinic({
    clinicName: cd.clinicName,
    city: cd.address?.city,
    registrationNumber: cd.clinicRegistrationNumber,
  });

  if (!clinic) {
    clinic = await clinicRepository.create({
      clinicName: cd.clinicName,
      clinicType: cd.clinicType ?? 'CLINIC',
      registrationNumber: cd.clinicRegistrationNumber,
      registrationAuthority: cd.registrationAuthority,
      ownerName: cd.relationship === 'OWNER' ? application.personalDetails?.fullName : undefined,
      contactNumber: application.personalDetails?.phoneNumber,
      address: cd.address ?? {},
      verificationStatus: CLINIC_VERIFICATION_STATUS.PENDING,
    });
  }

  const relationshipType = cd.relationship === 'OWNER' ? 'OWNER' : 'CONSULTANT';
  const association = await clinicRepository.upsertAssociation({
    doctorUserId: application.userId,
    applicationId: application._id,
    clinicId: clinic._id,
    relationshipType,
    verificationStatus: ASSOCIATION_VERIFICATION_STATUS.PENDING,
  });

  return { clinic, association };
};

export const listVerifiedClinics = async (query) => {
  const result = await clinicRepository.list({
    ...query,
    verificationStatus: CLINIC_VERIFICATION_STATUS.VERIFIED,
  });
  return {
    clinics: result.items.map(toPublicClinic),
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / result.limit) || 0,
    },
  };
};

export const associateDoctorWithExistingClinic = async (user, input) => {
  const clinic = await clinicRepository.findById(input.clinicId);
  if (!clinic) throw new ApiError(404, 'Clinic not found', 'CLINIC_NOT_FOUND');

  const association = await clinicRepository.upsertAssociation({
    doctorUserId: user._id,
    clinicId: clinic._id,
    relationshipType: input.relationshipType,
    affiliationDocumentId: input.affiliationDocumentId,
    verificationStatus: ASSOCIATION_VERIFICATION_STATUS.PENDING,
  });

  return { clinic: toPublicClinic(clinic), association: toPublicAssociation(association) };
};

export const getMyClinicAssociations = async (user) => {
  const items = await clinicRepository.findAssociationsByDoctorUserId(user._id);
  return items.map(toPublicAssociation);
};

export const getPermittedClinicById = async (user, clinicId) => {
  const clinic = await clinicRepository.findById(clinicId);
  if (!clinic) throw new ApiError(404, 'Clinic not found', 'CLINIC_NOT_FOUND');

  if (
    clinic.verificationStatus === CLINIC_VERIFICATION_STATUS.VERIFIED ||
    user.role === ROLES.ADMIN ||
    (clinic.createdByUserId && String(clinic.createdByUserId) === String(user._id))
  ) {
    return toPublicClinic(clinic);
  }
  if (clinic.organizationId) {
    const org = await organizationRepository.findById(clinic.organizationId);
    if (org && String(org.ownerUserId) === String(user._id)) {
      return toPublicClinic(clinic);
    }
  }
  throw new ApiError(403, 'You are not authorized to view this clinic', 'FORBIDDEN');
};

// Admin operations
export const listClinicsForAdmin = async (query) => {
  const result = await clinicRepository.list(query);
  return {
    clinics: result.items.map(toPublicClinic),
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / result.limit) || 0,
    },
  };
};

export const getClinicDetailsForAdmin = async (clinicId) => {
  const clinic = await clinicRepository.findById(clinicId);
  if (!clinic) throw new ApiError(404, 'Clinic not found', 'CLINIC_NOT_FOUND');
  const associations = await clinicRepository.findAssociationsByClinicId(clinic._id);
  return {
    clinic: toPublicClinic(clinic),
    associations: associations.map(toPublicAssociation),
  };
};

const CLINIC_AUDIT_ACTION = {
  [CLINIC_VERIFICATION_STATUS.VERIFIED]: AUDIT_ACTIONS.CLINIC_VERIFIED,
  [CLINIC_VERIFICATION_STATUS.NEEDS_CORRECTION]: AUDIT_ACTIONS.CLINIC_CORRECTION_REQUESTED,
  [CLINIC_VERIFICATION_STATUS.REJECTED]: AUDIT_ACTIONS.CLINIC_REJECTED,
};

export const verifyClinicByAdmin = async (adminUser, clinicId, { verificationStatus, remarks }) => {
  const existing = await clinicRepository.findById(clinicId);
  if (!existing) throw new ApiError(404, 'Clinic not found', 'CLINIC_NOT_FOUND');

  const updated = await clinicRepository.updateVerification(clinicId, {
    verificationStatus,
    verifiedBy: adminUser._id,
    verifiedAt: new Date(),
    ...(remarks !== undefined ? { verificationRemarks: remarks } : {}),
  });

  await recordAuditEvent({
    actorUserId: adminUser._id,
    action: CLINIC_AUDIT_ACTION[verificationStatus] ?? AUDIT_ACTIONS.CLINIC_VERIFICATION_UPDATED,
    targetType: AUDIT_TARGET_TYPES.CLINIC,
    targetId: existing._id,
    previousStatus: existing.verificationStatus,
    newStatus: verificationStatus,
    remarks,
  });

  return toPublicClinic(updated);
};

export const associateDoctorToClinicByAdmin = async (adminUser, clinicId, input) => {
  const clinic = await clinicRepository.findById(clinicId);
  if (!clinic) throw new ApiError(404, 'Clinic not found', 'CLINIC_NOT_FOUND');

  const status = input.verificationStatus ?? ASSOCIATION_VERIFICATION_STATUS.VERIFIED;
  const association = await clinicRepository.upsertAssociation({
    doctorUserId: input.doctorUserId,
    clinicId: clinic._id,
    relationshipType: input.relationshipType,
    affiliationDocumentId: input.affiliationDocumentId,
    verificationStatus: status,
  });

  await recordAuditEvent({
    actorUserId: adminUser._id,
    action: AUDIT_ACTIONS.DOCTOR_CLINIC_ASSOCIATION_CREATED,
    targetType: AUDIT_TARGET_TYPES.DOCTOR_CLINIC_ASSOCIATION,
    targetId: association._id,
    newStatus: status,
    remarks: input.remarks,
    metadata: { clinicId: String(clinic._id), doctorUserId: String(input.doctorUserId), relationshipType: input.relationshipType },
  });

  return toPublicAssociation(association);
};

export const verifyAssociationByAdmin = async (adminUser, associationId, { verificationStatus, remarks }) => {
  const existing = await clinicRepository.findAssociationById(associationId);
  if (!existing) throw new ApiError(404, 'Doctor-clinic association not found', 'ASSOCIATION_NOT_FOUND');

  const updated = await clinicRepository.updateAssociationVerification(associationId, {
    verificationStatus,
    verifiedBy: adminUser._id,
    verifiedAt: new Date(),
    ...(remarks !== undefined ? { remarks } : {}),
  });

  await recordAuditEvent({
    actorUserId: adminUser._id,
    action: AUDIT_ACTIONS.DOCTOR_CLINIC_ASSOCIATION_VERIFIED,
    targetType: AUDIT_TARGET_TYPES.DOCTOR_CLINIC_ASSOCIATION,
    targetId: existing._id,
    previousStatus: existing.verificationStatus,
    newStatus: verificationStatus,
    remarks,
  });

  return toPublicAssociation(updated);
};
