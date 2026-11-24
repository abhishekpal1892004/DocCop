import { FIELD_RESULT, getCouncilName } from '../../integrations/nmc/nmc.constants.js';
import {
  CLINIC_VERIFICATION_TRACK_STATUS,
  GST_VERIFICATION_TRACK_STATUS,
  PROFESSIONAL_VERIFICATION_STATUS,
} from './verification.constants.js';
import { doctorVerificationRepository } from './verification.repository.js';

export const toPublicVerification = (v) => {
  if (!v) return null;
  return {
    id: String(v._id),
    applicationId: String(v.applicationId),
    professional: v.professional ?? {},
    clinic: v.clinic ?? {},
    gst: v.gst ?? {},
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  };
};

/**
 * Ensures a DoctorVerification record exists when an application is submitted.
 * Preserves any prior verification history on re-submission.
 */
export const ensureVerificationForApplication = async (application, clinicId = null) => {
  const gstRegistered = Boolean(application.gstDetails?.isGSTRegistered && application.gstDetails?.gstin);
  return doctorVerificationRepository.upsertInitial(application._id, application.userId, {
    professional: {
      status: PROFESSIONAL_VERIFICATION_STATUS.PENDING,
      registrationNumberChecked: application.medicalRegistration?.registrationNumber,
    },
    clinic: {
      status: CLINIC_VERIFICATION_TRACK_STATUS.PENDING,
      clinicId,
      clinicName: application.clinicDetails?.clinicName,
      registrationNumberChecked: application.clinicDetails?.clinicRegistrationNumber,
    },
    gst: {
      status: gstRegistered ? GST_VERIFICATION_TRACK_STATUS.PENDING : GST_VERIFICATION_TRACK_STATUS.NOT_PROVIDED,
      gstin: application.gstDetails?.gstin ?? undefined,
      legalBusinessName: application.gstDetails?.legalBusinessName ?? undefined,
    },
  });
};

/**
 * Side-by-side comparison of doctor-submitted registration info vs NMC-returned record.
 * Never invents missing NMC fields: missing fields are reported as NOT_AVAILABLE.
 */
export const buildNmcSideBySideComparison = (application, latestLookup) => {
  const submitted = {
    fullName: application.personalDetails?.fullName ?? null,
    registrationNumber: application.medicalRegistration?.registrationNumber ?? null,
    registrationYear: application.medicalRegistration?.registrationYear ?? null,
    stateCode: application.medicalRegistration?.stateCode ?? null,
    councilName:
      application.medicalRegistration?.councilName ??
      getCouncilName(application.medicalRegistration?.stateCode) ??
      null,
    medicalSystem: application.professionalDetails?.medicalSystem ?? null,
    qualification: application.professionalDetails?.qualification ?? null,
  };

  if (!latestLookup) {
    return {
      lookupStatus: 'NOT_CHECKED',
      checkedAt: null,
      doctorSubmitted: submitted,
      nmcReturned: null,
      fieldComparison: null,
    };
  }

  const top = latestLookup.matchedRecords?.[0] ?? null;
  const nmcReturned = top
    ? {
        name: top.name ?? 'NOT_AVAILABLE',
        registrationNumber: top.registrationNumber ?? 'NOT_AVAILABLE',
        registrationYear: top.registrationYear ?? 'NOT_AVAILABLE',
        stateCode: top.stateCode ?? 'NOT_AVAILABLE',
        councilName: top.councilName ?? 'NOT_AVAILABLE',
        qualification: top.qualification ?? 'NOT_AVAILABLE',
        university: top.university ?? 'NOT_AVAILABLE',
        removedStatus: top.removedStatus ?? 'NOT_AVAILABLE',
      }
    : null;

  const fieldComparison = top?.comparison
    ? {
        name: top.comparison.name ?? FIELD_RESULT.NOT_AVAILABLE,
        registrationNumber: top.comparison.registrationNumber ?? FIELD_RESULT.NOT_AVAILABLE,
        registrationYear: top.comparison.registrationYear ?? FIELD_RESULT.NOT_AVAILABLE,
        council: top.comparison.council ?? FIELD_RESULT.NOT_AVAILABLE,
      }
    : null;

  return {
    lookupStatus: latestLookup.lookupStatus,
    checkedAt: latestLookup.checkedAt ?? null,
    summary: latestLookup.summary ?? null,
    supersededAt: latestLookup.supersededAt ?? null,
    doctorSubmitted: submitted,
    nmcReturned,
    fieldComparison,
  };
};
