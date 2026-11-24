import mongoose from 'mongoose';
import { ApiError } from '../../utils/ApiError.js';
import { AUDIT_ACTIONS, AUDIT_TARGET_TYPES } from '../auditLogs/auditLog.constants.js';
import { recordAuditEvent } from '../auditLogs/auditLog.service.js';
import { ASSOCIATION_VERIFICATION_STATUS, CLINIC_VERIFICATION_STATUS } from '../clinics/clinic.constants.js';
import { clinicRepository } from '../clinics/clinic.repository.js';
import { syncClinicFromApplication, toPublicAssociation } from '../clinics/clinic.service.js';
import { APPLICATION_STATUS, IN_REVIEW_STATUSES } from '../doctorApplications/doctorApplication.constants.js';
import { doctorApplicationRepository } from '../doctorApplications/doctorApplication.repository.js';
import { toPublicApplication } from '../doctorApplications/doctorApplication.service.js';
import { doctorRepository } from '../doctors/doctor.repository.js';
import { toPublicDoctor } from '../doctors/doctor.service.js';
import { nmcLookupRepository } from '../doctorVerification/nmcLookup.repository.js';
import {
  CLINIC_VERIFICATION_TRACK_STATUS,
  GST_VERIFICATION_TRACK_STATUS,
  GST_PORTAL_URL,
  PROFESSIONAL_VERIFICATION_STATUS,
} from '../doctorVerification/verification.constants.js';
import { doctorVerificationRepository } from '../doctorVerification/verification.repository.js';
import {
  buildNmcSideBySideComparison,
  ensureVerificationForApplication,
  toPublicVerification,
} from '../doctorVerification/verification.service.js';
import { ONBOARDING_STATUS, ROLES } from '../users/user.constants.js';
import { userRepository } from '../users/user.repository.js';
import { markOnboardingStatusByUserId } from '../users/user.service.js';

const runWithOptionalTransaction = async (fn) => {
  if (mongoose.connection?.readyState !== 1) {
    return fn(undefined);
  }
  const session = await mongoose.startSession();
  try {
    let result;
    try {
      await session.withTransaction(async () => {
        result = await fn(session);
      });
      return result;
    } catch (err) {
      // Standalone MongoDB instances throw code 20 / IllegalOperation for transactions.
      const msg = String(err?.message ?? '');
      if (err?.code === 20 || msg.includes('Transaction numbers are only allowed on a replica set')) {
        return fn(undefined);
      }
      throw err;
    }
  } finally {
    await session.endSession();
  }
};

export const getAdminDashboardStats = async () => {
  const [
    totalPatients,
    totalDoctors,
    pendingApplications,
    verifiedDoctors,
    rejectedApplications,
    totalClinics,
    verifiedClinics,
    pendingClinicVerifications,
  ] = await Promise.all([
    userRepository.countByRole(ROLES.PATIENT),
    userRepository.countByRole(ROLES.DOCTOR),
    doctorApplicationRepository.countByStatuses([
      APPLICATION_STATUS.SUBMITTED,
      APPLICATION_STATUS.UNDER_REVIEW,
      APPLICATION_STATUS.NEEDS_INFORMATION,
    ]),
    doctorRepository.countByProfileStatus('PUBLISHED'),
    doctorApplicationRepository.countByStatuses([APPLICATION_STATUS.REJECTED]),
    clinicRepository.countAll(),
    clinicRepository.countByStatus(CLINIC_VERIFICATION_STATUS.VERIFIED),
    clinicRepository.countByStatus(CLINIC_VERIFICATION_STATUS.PENDING),
  ]);

  return {
    totalPatients,
    totalDoctors,
    pendingApplications,
    verifiedDoctors,
    rejectedApplications,
    totalClinics,
    verifiedClinics,
    pendingClinicVerifications,
  };
};

export const listApplicationsForAdmin = async (query) => {
  const result = await doctorApplicationRepository.listForReview(query);
  return {
    applications: result.items.map(toPublicApplication),
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / result.limit) || 0,
    },
  };
};

export const getApplicationDetailsForAdmin = async (applicationId) => {
  const app = await doctorApplicationRepository.findById(applicationId);
  if (!app) throw new ApiError(404, 'Doctor application not found', 'APPLICATION_NOT_FOUND');

  const [verification, nmcLookups, associations] = await Promise.all([
    doctorVerificationRepository.findByApplicationId(app._id),
    nmcLookupRepository.findByApplicationId(app._id),
    clinicRepository.findAssociationsByDoctorUserId(app.userId),
  ]);

  return {
    application: toPublicApplication(app),
    verification: toPublicVerification(verification),
    nmcComparison: buildNmcSideBySideComparison(app, nmcLookups[0] ?? null),
    nmcLookups,
    clinicAssociations: associations.map(toPublicAssociation),
  };
};

export const startApplicationReview = async (adminUser, applicationId) => {
  const existing = await doctorApplicationRepository.findById(applicationId);
  if (!existing) throw new ApiError(404, 'Doctor application not found', 'APPLICATION_NOT_FOUND');

  if (existing.applicationStatus === APPLICATION_STATUS.UNDER_REVIEW) {
    return toPublicApplication(existing);
  }
  if (existing.applicationStatus !== APPLICATION_STATUS.SUBMITTED) {
    throw new ApiError(
      409,
      `Cannot start review on an application in ${existing.applicationStatus} status`,
      'INVALID_APPLICATION_TRANSITION'
    );
  }

  const now = new Date();
  const updated = await doctorApplicationRepository.reviewTransition(
    applicationId,
    [APPLICATION_STATUS.SUBMITTED],
    {
      applicationStatus: APPLICATION_STATUS.UNDER_REVIEW,
      reviewedBy: adminUser._id,
      reviewedAt: now,
    }
  );
  if (!updated) {
    throw new ApiError(409, 'Application state changed concurrently', 'INVALID_APPLICATION_TRANSITION');
  }

  await ensureVerificationForApplication(updated);

  await recordAuditEvent({
    actorUserId: adminUser._id,
    action: AUDIT_ACTIONS.APPLICATION_REVIEW_STARTED,
    targetType: AUDIT_TARGET_TYPES.DOCTOR_APPLICATION,
    targetId: updated._id,
    previousStatus: APPLICATION_STATUS.SUBMITTED,
    newStatus: APPLICATION_STATUS.UNDER_REVIEW,
  });

  return toPublicApplication(updated);
};

export const updateProfessionalVerification = async (adminUser, applicationId, input) => {
  const app = await doctorApplicationRepository.findById(applicationId);
  if (!app) throw new ApiError(404, 'Doctor application not found', 'APPLICATION_NOT_FOUND');
  if (!IN_REVIEW_STATUSES.includes(app.applicationStatus)) {
    throw new ApiError(409, 'Application must be submitted or under review to update verification', 'APPLICATION_LOCKED');
  }

  const current = await ensureVerificationForApplication(app);
  const prevStatus = current.professional?.status ?? PROFESSIONAL_VERIFICATION_STATUS.PENDING;

  const updated = await doctorVerificationRepository.updateTrack(app._id, {
    'professional.status': input.status,
    'professional.verificationMethod': input.verificationMethod,
    'professional.officialSource': input.officialSource,
    'professional.registrationNumberChecked':
      input.registrationNumberChecked ?? app.medicalRegistration?.registrationNumber,
    'professional.checkedAt': new Date(),
    'professional.verifiedBy': adminUser._id,
    ...(input.remarks !== undefined ? { 'professional.remarks': input.remarks } : {}),
  });

  await recordAuditEvent({
    actorUserId: adminUser._id,
    action: AUDIT_ACTIONS.PROFESSIONAL_VERIFICATION_UPDATED,
    targetType: AUDIT_TARGET_TYPES.DOCTOR_APPLICATION,
    targetId: app._id,
    previousStatus: prevStatus,
    newStatus: input.status,
    remarks: input.remarks,
    metadata: { verificationMethod: input.verificationMethod, officialSource: input.officialSource },
  });

  return toPublicVerification(updated);
};

export const updateClinicVerification = async (adminUser, applicationId, input) => {
  const app = await doctorApplicationRepository.findById(applicationId);
  if (!app) throw new ApiError(404, 'Doctor application not found', 'APPLICATION_NOT_FOUND');
  if (!IN_REVIEW_STATUSES.includes(app.applicationStatus)) {
    throw new ApiError(409, 'Application must be submitted or under review to update verification', 'APPLICATION_LOCKED');
  }

  let current = await ensureVerificationForApplication(app);
  let clinicId = current.clinic?.clinicId ?? null;
  if (!clinicId && app.clinicDetails?.clinicName) {
    const { clinic } = await syncClinicFromApplication(app);
    clinicId = clinic?._id ?? null;
  }

  const prevStatus = current.clinic?.status ?? CLINIC_VERIFICATION_TRACK_STATUS.PENDING;
  const now = new Date();

  const updated = await doctorVerificationRepository.updateTrack(app._id, {
    'clinic.status': input.status,
    ...(clinicId ? { 'clinic.clinicId': clinicId } : {}),
    'clinic.registrationNumberChecked':
      input.registrationNumberChecked ?? app.clinicDetails?.clinicRegistrationNumber,
    'clinic.checkedAt': now,
    'clinic.verifiedBy': adminUser._id,
    ...(input.remarks !== undefined ? { 'clinic.remarks': input.remarks } : {}),
  });

  if (clinicId && Object.hasOwn(CLINIC_VERIFICATION_STATUS, input.status)) {
    await clinicRepository.updateVerification(clinicId, {
      verificationStatus: input.status,
      verifiedBy: adminUser._id,
      verifiedAt: now,
      ...(input.remarks !== undefined ? { verificationRemarks: input.remarks } : {}),
    });
  }

  if (input.status === CLINIC_VERIFICATION_TRACK_STATUS.VERIFIED) {
    const associations = await clinicRepository.findAssociationsByDoctorUserId(app.userId);
    for (const assoc of associations) {
      if (!clinicId || String(assoc.clinicId) === String(clinicId)) {
        await clinicRepository.updateAssociationVerification(assoc._id, {
          verificationStatus: ASSOCIATION_VERIFICATION_STATUS.VERIFIED,
          verifiedBy: adminUser._id,
          verifiedAt: now,
        });
      }
    }
  }

  await recordAuditEvent({
    actorUserId: adminUser._id,
    action: AUDIT_ACTIONS.CLINIC_VERIFICATION_UPDATED,
    targetType: AUDIT_TARGET_TYPES.DOCTOR_APPLICATION,
    targetId: app._id,
    previousStatus: prevStatus,
    newStatus: input.status,
    remarks: input.remarks,
    metadata: clinicId ? { clinicId: String(clinicId) } : {},
  });

  return toPublicVerification(updated);
};

export const updateGstVerification = async (adminUser, applicationId, input) => {
  const app = await doctorApplicationRepository.findById(applicationId);
  if (!app) throw new ApiError(404, 'Doctor application not found', 'APPLICATION_NOT_FOUND');
  if (!IN_REVIEW_STATUSES.includes(app.applicationStatus)) {
    throw new ApiError(409, 'Application must be submitted or under review to update verification', 'APPLICATION_LOCKED');
  }

  const current = await ensureVerificationForApplication(app);
  const prevStatus = current.gst?.status ?? GST_VERIFICATION_TRACK_STATUS.NOT_PROVIDED;

  const updated = await doctorVerificationRepository.updateTrack(app._id, {
    'gst.status': input.status,
    'gst.gstin': input.gstin ?? app.gstDetails?.gstin,
    'gst.legalBusinessName': input.legalBusinessName ?? app.gstDetails?.legalBusinessName,
    ...(input.tradeName !== undefined ? { 'gst.tradeName': input.tradeName } : {}),
    ...(input.state !== undefined ? { 'gst.state': input.state } : {}),
    ...(input.principalPlaceOfBusiness !== undefined
      ? { 'gst.principalPlaceOfBusiness': input.principalPlaceOfBusiness }
      : {}),
    ...(input.registrationStatus !== undefined ? { 'gst.registrationStatus': input.registrationStatus } : {}),
    ...(input.registrationEffectiveDate !== undefined
      ? { 'gst.registrationEffectiveDate': input.registrationEffectiveDate }
      : {}),
    'gst.verificationSource': input.verificationSource ?? GST_PORTAL_URL,
    'gst.checkedAt': new Date(),
    'gst.verifiedBy': adminUser._id,
    ...(input.remarks !== undefined ? { 'gst.remarks': input.remarks } : {}),
  });

  await recordAuditEvent({
    actorUserId: adminUser._id,
    action: AUDIT_ACTIONS.GST_VERIFICATION_UPDATED,
    targetType: AUDIT_TARGET_TYPES.DOCTOR_APPLICATION,
    targetId: app._id,
    previousStatus: prevStatus,
    newStatus: input.status,
    remarks: input.remarks,
  });

  return toPublicVerification(updated);
};

export const requestMoreInformation = async (adminUser, applicationId, { remarks, fieldsToCorrect = [] }) => {
  const existing = await doctorApplicationRepository.findById(applicationId);
  if (!existing) throw new ApiError(404, 'Doctor application not found', 'APPLICATION_NOT_FOUND');
  if (!IN_REVIEW_STATUSES.includes(existing.applicationStatus)) {
    throw new ApiError(
      409,
      `Cannot request information on an application in ${existing.applicationStatus} status`,
      'INVALID_APPLICATION_TRANSITION'
    );
  }

  const now = new Date();
  const updated = await doctorApplicationRepository.reviewTransition(applicationId, IN_REVIEW_STATUSES, {
    applicationStatus: APPLICATION_STATUS.NEEDS_INFORMATION,
    reviewedBy: adminUser._id,
    reviewedAt: now,
    reviewNotes: remarks,
    requestedChanges: remarks,
    fieldsToCorrect,
    rejectionReason: null,
  });
  if (!updated) {
    throw new ApiError(409, 'Application state changed concurrently', 'INVALID_APPLICATION_TRANSITION');
  }

  await markOnboardingStatusByUserId(updated.userId, ONBOARDING_STATUS.IN_PROGRESS);

  await recordAuditEvent({
    actorUserId: adminUser._id,
    action: AUDIT_ACTIONS.MORE_INFO_REQUESTED,
    targetType: AUDIT_TARGET_TYPES.DOCTOR_APPLICATION,
    targetId: updated._id,
    previousStatus: existing.applicationStatus,
    newStatus: APPLICATION_STATUS.NEEDS_INFORMATION,
    remarks,
    metadata: { fieldsToCorrect },
  });

  return toPublicApplication(updated);
};

const assertEligibleForApproval = (app, verification, associations) => {
  const missing = [];
  if (!IN_REVIEW_STATUSES.includes(app.applicationStatus)) {
    throw new ApiError(
      409,
      `Cannot approve an application in ${app.applicationStatus} status`,
      'INVALID_APPLICATION_TRANSITION'
    );
  }
  if (!app.personalDetails?.fullName || !app.personalDetails?.email) {
    missing.push('Required personal information is incomplete');
  }
  if (verification?.professional?.status !== PROFESSIONAL_VERIFICATION_STATUS.VERIFIED) {
    missing.push('Professional verification must be VERIFIED');
  }

  const clinicStatus = verification?.clinic?.status;
  const clinicOk =
    clinicStatus === CLINIC_VERIFICATION_TRACK_STATUS.VERIFIED ||
    (clinicStatus === CLINIC_VERIFICATION_TRACK_STATUS.NOT_APPLICABLE && Boolean(verification?.clinic?.remarks?.trim()));
  if (!clinicOk) {
    missing.push('Clinic verification must be VERIFIED or marked NOT_APPLICABLE with remarks');
  }

  const gstStatus = verification?.gst?.status;
  const gstRequired = Boolean(app.gstDetails?.isGSTRegistered);
  const gstOk = gstRequired
    ? gstStatus === GST_VERIFICATION_TRACK_STATUS.VERIFIED || gstStatus === GST_VERIFICATION_TRACK_STATUS.NOT_APPLICABLE
    : gstStatus === GST_VERIFICATION_TRACK_STATUS.NOT_PROVIDED ||
      gstStatus === GST_VERIFICATION_TRACK_STATUS.NOT_APPLICABLE ||
      gstStatus === GST_VERIFICATION_TRACK_STATUS.VERIFIED;
  if (!gstOk) {
    missing.push('GST verification is incomplete');
  }

  if (clinicStatus === CLINIC_VERIFICATION_TRACK_STATUS.VERIFIED && associations.length > 0) {
    const hasVerifiedAssoc = associations.some(
      (a) => a.verificationStatus === ASSOCIATION_VERIFICATION_STATUS.VERIFIED
    );
    if (!hasVerifiedAssoc) {
      missing.push('Doctor-clinic affiliation must be verified');
    }
  }

  if (missing.length > 0) {
    throw new ApiError(422, missing.join('; '), 'VERIFICATION_INCOMPLETE', missing);
  }
};

export const approveDoctorApplication = async (adminUser, applicationId, { remarks } = {}) => {
  const existing = await doctorApplicationRepository.findById(applicationId);
  if (!existing) throw new ApiError(404, 'Doctor application not found', 'APPLICATION_NOT_FOUND');

  // Idempotent if already approved.
  if (existing.applicationStatus === APPLICATION_STATUS.APPROVED) {
    const existingDoctor = await doctorRepository.findByUserId(existing.userId);
    return {
      application: toPublicApplication(existing),
      doctor: existingDoctor ? toPublicDoctor(existingDoctor) : null,
    };
  }

  const [verification, associations] = await Promise.all([
    doctorVerificationRepository.findByApplicationId(existing._id),
    clinicRepository.findAssociationsByDoctorUserId(existing.userId),
  ]);

  assertEligibleForApproval(existing, verification, associations);

  const now = new Date();
  const clinicIds = associations.map((a) => a.clinicId);
  const primaryClinicId = verification?.clinic?.clinicId ?? clinicIds[0] ?? null;

  const { updatedApp, doctor } = await runWithOptionalTransaction(async (session) => {
    const appDoc = await doctorApplicationRepository.reviewTransition(
      applicationId,
      IN_REVIEW_STATUSES,
      {
        applicationStatus: APPLICATION_STATUS.APPROVED,
        reviewedBy: adminUser._id,
        reviewedAt: now,
        ...(remarks !== undefined ? { reviewNotes: remarks } : {}),
        requestedChanges: null,
        rejectionReason: null,
        fieldsToCorrect: [],
      },
      { session }
    );
    if (!appDoc) {
      throw new ApiError(409, 'Application state changed concurrently', 'INVALID_APPLICATION_TRANSITION');
    }

    const doctorDoc = await doctorRepository.upsertFromApplication(appDoc, adminUser._id, now, {
      primaryClinicId,
      clinicIds,
      session,
    });

    await clinicRepository.linkDoctorProfileToAssociations(appDoc.userId, doctorDoc._id, { session });

    await recordAuditEvent(
      {
        actorUserId: adminUser._id,
        action: AUDIT_ACTIONS.DOCTOR_APPROVED,
        targetType: AUDIT_TARGET_TYPES.DOCTOR_APPLICATION,
        targetId: appDoc._id,
        previousStatus: existing.applicationStatus,
        newStatus: APPLICATION_STATUS.APPROVED,
        remarks,
        metadata: { doctorProfileId: String(doctorDoc._id) },
      },
      { session }
    );

    return { updatedApp: appDoc, doctor: doctorDoc };
  });

  await markOnboardingStatusByUserId(updatedApp.userId, ONBOARDING_STATUS.APPROVED);

  return {
    application: toPublicApplication(updatedApp),
    doctor: toPublicDoctor(doctor),
  };
};

export const rejectDoctorApplication = async (adminUser, applicationId, { reason, remarks }) => {
  const existing = await doctorApplicationRepository.findById(applicationId);
  if (!existing) throw new ApiError(404, 'Doctor application not found', 'APPLICATION_NOT_FOUND');
  if (!IN_REVIEW_STATUSES.includes(existing.applicationStatus)) {
    throw new ApiError(
      409,
      `Cannot reject an application in ${existing.applicationStatus} status`,
      'INVALID_APPLICATION_TRANSITION'
    );
  }

  const now = new Date();
  const updated = await doctorApplicationRepository.reviewTransition(applicationId, IN_REVIEW_STATUSES, {
    applicationStatus: APPLICATION_STATUS.REJECTED,
    reviewedBy: adminUser._id,
    reviewedAt: now,
    rejectionReason: reason,
    ...(remarks !== undefined ? { reviewNotes: remarks } : {}),
  });
  if (!updated) {
    throw new ApiError(409, 'Application state changed concurrently', 'INVALID_APPLICATION_TRANSITION');
  }

  await markOnboardingStatusByUserId(updated.userId, ONBOARDING_STATUS.REJECTED);

  await recordAuditEvent({
    actorUserId: adminUser._id,
    action: AUDIT_ACTIONS.APPLICATION_REJECTED,
    targetType: AUDIT_TARGET_TYPES.DOCTOR_APPLICATION,
    targetId: updated._id,
    previousStatus: existing.applicationStatus,
    newStatus: APPLICATION_STATUS.REJECTED,
    remarks: reason,
  });

  return toPublicApplication(updated);
};

export const listDoctorsForAdmin = async (query) => {
  const result = await doctorRepository.listForAdmin(query);
  return {
    doctors: result.items.map(toPublicDoctor),
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / result.limit) || 0,
    },
  };
};

export const updateDoctorStatusByAdmin = async (adminUser, doctorId, { profileStatus, reason }) => {
  const existing = await doctorRepository.findById(doctorId);
  if (!existing) throw new ApiError(404, 'Doctor profile not found', 'DOCTOR_NOT_FOUND');

  const now = new Date();
  const set =
    profileStatus === 'SUSPENDED'
      ? { profileStatus, suspensionReason: reason, suspendedAt: now, suspendedBy: adminUser._id }
      : { profileStatus, suspensionReason: null, suspendedAt: null, suspendedBy: null };

  const updated = await doctorRepository.updateProfileStatus(doctorId, set);

  await recordAuditEvent({
    actorUserId: adminUser._id,
    action: profileStatus === 'SUSPENDED' ? AUDIT_ACTIONS.DOCTOR_SUSPENDED : AUDIT_ACTIONS.DOCTOR_REACTIVATED,
    targetType: AUDIT_TARGET_TYPES.DOCTOR_PROFILE,
    targetId: existing._id,
    previousStatus: existing.profileStatus ?? 'PUBLISHED',
    newStatus: profileStatus,
    remarks: reason,
  });

  return toPublicDoctor(updated);
};
