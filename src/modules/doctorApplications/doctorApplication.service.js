import { ApiError } from '../../utils/ApiError.js';
import { markOnboardingStatus } from '../users/user.service.js';
import { ONBOARDING_STATUS } from '../users/user.constants.js';
import { invalidateLookups } from '../doctorVerification/doctorVerification.service.js';
import { ensureVerificationForApplication } from '../doctorVerification/verification.service.js';
import { doctorVerificationRepository } from '../doctorVerification/verification.repository.js';
import { syncClinicFromApplication } from '../clinics/clinic.service.js';
import { normalizeRegistrationNumber, nameTokens } from '../../integrations/nmc/nmc.matcher.js';
import { normalizeStateCode } from '../../integrations/nmc/nmc.constants.js';
import { doctorApplicationRepository } from './doctorApplication.repository.js';
import { submitSchema } from './doctorApplication.validation.js';
import {
  APPLICATION_STATUS,
  EDITABLE_STATUSES,
  GST_VERIFICATION_STATUS,
  IN_REVIEW_STATUSES,
  NMC_VERIFICATION_STATUS,
} from './doctorApplication.constants.js';

export const toPublicApplication = (app) => ({
  id: String(app._id),
  personalDetails: app.personalDetails ?? {},
  professionalDetails: app.professionalDetails ?? {},
  medicalRegistration: app.medicalRegistration ?? {},
  clinicDetails: app.clinicDetails ?? {},
  gstDetails: app.gstDetails ?? {},
  applicationStatus: app.applicationStatus,
  nmcVerificationStatus: app.nmcVerificationStatus,
  nmcCheckedAt: app.nmcCheckedAt ?? null,
  submittedAt: app.submittedAt ?? null,
  reviewedAt: app.reviewedAt ?? null,
  reviewNotes: app.reviewNotes ?? null,
  rejectionReason: app.rejectionReason ?? null,
  requestedChanges: app.requestedChanges ?? null,
  fieldsToCorrect: app.fieldsToCorrect ?? [],
  createdAt: app.createdAt,
  updatedAt: app.updatedAt,
});

/** Flatten a nested partial object into Mongo dot-paths so untouched sibling fields survive. */
const flatten = (obj, prefix = '') =>
  Object.entries(obj).reduce((acc, [key, value]) => {
    if (value === undefined) return acc;
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !(value instanceof Date) && !Array.isArray(value)) {
      Object.assign(acc, flatten(value, path));
    } else {
      acc[path] = value;
    }
    return acc;
  }, {});

const registrationChanged = (existing, input) => {
  const prevReg = existing.medicalRegistration ?? {};
  const nextReg = input.medicalRegistration ?? {};
  if (
    nextReg.registrationNumber !== undefined &&
    normalizeRegistrationNumber(nextReg.registrationNumber) !== normalizeRegistrationNumber(prevReg.registrationNumber)
  ) {
    return true;
  }
  if (nextReg.registrationYear !== undefined && Number(nextReg.registrationYear) !== Number(prevReg.registrationYear)) {
    return true;
  }
  if (nextReg.stateCode !== undefined && normalizeStateCode(nextReg.stateCode) !== normalizeStateCode(prevReg.stateCode)) {
    return true;
  }
  const nextName = input.personalDetails?.fullName;
  if (nextName !== undefined && nameTokens(nextName).join(' ') !== nameTokens(existing.personalDetails?.fullName).join(' ')) {
    return true;
  }
  return false;
};

export const createApplication = async (user, input = {}) => {
  const existing = await doctorApplicationRepository.findByUserId(user._id);
  if (existing) {
    throw new ApiError(409, 'Doctor application already exists', 'APPLICATION_ALREADY_EXISTS');
  }

  const gstDetails = input.gstDetails ? { ...input.gstDetails } : {};
  gstDetails.verificationStatus = gstDetails.gstin
    ? GST_VERIFICATION_STATUS.FORMAT_VALID_UNVERIFIED
    : GST_VERIFICATION_STATUS.NOT_PROVIDED;

  const payload = {
    userId: user._id,
    personalDetails: {
      ...(input.personalDetails ?? {}),
      fullName: input.personalDetails?.fullName ?? user.fullName,
      email: user.email,
      profileImage: user.profileImage,
    },
    professionalDetails: input.professionalDetails ?? {},
    medicalRegistration: input.medicalRegistration ?? {},
    clinicDetails: input.clinicDetails ?? {},
    gstDetails,
    applicationStatus: APPLICATION_STATUS.DRAFT,
    nmcVerificationStatus: NMC_VERIFICATION_STATUS.NOT_CHECKED,
  };

  let created;
  try {
    created = await doctorApplicationRepository.create(payload);
  } catch (err) {
    if (err?.code === 11000) throw new ApiError(409, 'Doctor application already exists', 'APPLICATION_ALREADY_EXISTS');
    throw err;
  }

  await markOnboardingStatus(user.clerkUserId, ONBOARDING_STATUS.IN_PROGRESS);
  return created;
};

export const getMyApplication = async (user) => {
  const app = await doctorApplicationRepository.findByUserId(user._id);
  if (!app) throw new ApiError(404, 'Doctor application not found', 'APPLICATION_NOT_FOUND');
  return app;
};

export const updateMyApplication = async (user, input) => {
  const existing = await doctorApplicationRepository.findByUserId(user._id);
  if (!existing) throw new ApiError(404, 'Doctor application not found', 'APPLICATION_NOT_FOUND');
  if (!EDITABLE_STATUSES.includes(existing.applicationStatus)) {
    throw new ApiError(409, 'Submitted application cannot be edited unless corrections are requested', 'APPLICATION_LOCKED');
  }

  const set = flatten(input);

  // Keep email and profileImage synchronized with the authenticated User record.
  set['personalDetails.email'] = user.email;
  if (user.profileImage) set['personalDetails.profileImage'] = user.profileImage;

  if (input.gstDetails) {
    if (input.gstDetails.isGSTRegistered === false) {
      set['gstDetails.gstin'] = null;
      set['gstDetails.legalBusinessName'] = null;
      set['gstDetails.verificationStatus'] = GST_VERIFICATION_STATUS.NOT_PROVIDED;
    } else if (input.gstDetails.gstin) {
      set['gstDetails.verificationStatus'] = GST_VERIFICATION_STATUS.FORMAT_VALID_UNVERIFIED;
    }
  }

  let lookupsInvalidated = false;
  if (existing.nmcVerificationStatus !== NMC_VERIFICATION_STATUS.NOT_CHECKED && registrationChanged(existing, input)) {
    set.nmcVerificationStatus = NMC_VERIFICATION_STATUS.NOT_CHECKED;
    set.latestNmcLookupId = null;
    set.nmcCheckedAt = null;
    lookupsInvalidated = true;
  }

  const updated = await doctorApplicationRepository.update(user._id, set, EDITABLE_STATUSES);
  if (!updated) throw new ApiError(409, 'Application can no longer be edited', 'APPLICATION_LOCKED');

  if (lookupsInvalidated) {
    await invalidateLookups(existing._id);
  }
  return updated;
};

export const submitApplication = async (user) => {
  const existing = await doctorApplicationRepository.findByUserId(user._id);
  if (!existing) throw new ApiError(404, 'Doctor application not found', 'APPLICATION_NOT_FOUND');

  if (IN_REVIEW_STATUSES.includes(existing.applicationStatus)) {
    await markOnboardingStatus(user.clerkUserId, ONBOARDING_STATUS.PENDING_VERIFICATION);
    return { application: existing, submitted: false };
  }

  if (!EDITABLE_STATUSES.includes(existing.applicationStatus)) {
    throw new ApiError(409, 'Application cannot be submitted in its current state', 'APPLICATION_LOCKED');
  }

  // Validate completeness of all required sections.
  submitSchema.parse(existing);

  if (existing.nmcVerificationStatus === NMC_VERIFICATION_STATUS.NOT_CHECKED) {
    throw new ApiError(
      400,
      'Please run the NMC medical registration lookup before submitting your application',
      'NMC_CHECK_REQUIRED'
    );
  }

  const updated = await doctorApplicationRepository.update(
    user._id,
    { applicationStatus: APPLICATION_STATUS.SUBMITTED, submittedAt: new Date() },
    EDITABLE_STATUSES
  );
  if (!updated) throw new ApiError(409, 'Application cannot be submitted in its current state', 'APPLICATION_LOCKED');

  await markOnboardingStatus(user.clerkUserId, ONBOARDING_STATUS.PENDING_VERIFICATION);

  const { clinic } = await syncClinicFromApplication(updated);
  await ensureVerificationForApplication(updated, clinic?._id ?? null);

  return { application: updated, submitted: true };
};

export const getApplicationStatus = async (user) => {
  const app = await doctorApplicationRepository.findByUserId(user._id);
  if (!app) {
    return {
      onboardingStatus: user.onboardingStatus,
      applicationStatus: 'NOT_STARTED',
      nmcVerificationStatus: NMC_VERIFICATION_STATUS.NOT_CHECKED,
      professionalVerificationStatus: 'NOT_STARTED',
      clinicVerificationStatus: 'NOT_PROVIDED',
      gstVerificationStatus: GST_VERIFICATION_STATUS.NOT_PROVIDED,
      nmcCheckedAt: null,
      submittedAt: null,
      reviewNotes: null,
      rejectionReason: null,
      requestedChanges: null,
      fieldsToCorrect: [],
    };
  }

  const verification = await doctorVerificationRepository.findByApplicationId(app._id);

  return {
    onboardingStatus: user.onboardingStatus,
    applicationStatus: app.applicationStatus,
    nmcVerificationStatus: app.nmcVerificationStatus,
    professionalVerificationStatus: verification?.professional?.status ?? 'PENDING',
    clinicRegistrationStatus: app.clinicDetails?.clinicName ? 'PENDING_VERIFICATION' : 'NOT_PROVIDED',
    clinicVerificationStatus:
      verification?.clinic?.status ?? (app.clinicDetails?.clinicName ? 'PENDING' : 'NOT_PROVIDED'),
    gstVerificationStatus:
      verification?.gst?.status ?? app.gstDetails?.verificationStatus ?? GST_VERIFICATION_STATUS.NOT_PROVIDED,
    nmcCheckedAt: app.nmcCheckedAt ?? null,
    submittedAt: app.submittedAt ?? null,
    reviewedAt: app.reviewedAt ?? null,
    reviewNotes: app.reviewNotes ?? null,
    rejectionReason: app.rejectionReason ?? null,
    requestedChanges: app.requestedChanges ?? null,
    fieldsToCorrect: app.fieldsToCorrect ?? [],
  };
};
