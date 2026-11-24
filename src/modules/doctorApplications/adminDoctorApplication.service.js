import { ApiError } from '../../utils/ApiError.js';
import { markOnboardingStatusByUserId } from '../users/user.service.js';
import { ONBOARDING_STATUS } from '../users/user.constants.js';
import { nmcLookupRepository } from '../doctorVerification/nmcLookup.repository.js';
import { doctorRepository } from '../doctors/doctor.repository.js';
import { doctorApplicationRepository } from './doctorApplication.repository.js';
import { toPublicApplication } from './doctorApplication.service.js';
import { APPLICATION_STATUS, IN_REVIEW_STATUSES, REVIEW_ACTIONS } from './doctorApplication.constants.js';

const REVIEW_TRANSITIONS = Object.freeze({
  [REVIEW_ACTIONS.START_REVIEW]: {
    allowedFrom: [APPLICATION_STATUS.SUBMITTED],
    nextStatus: APPLICATION_STATUS.UNDER_REVIEW,
    userOnboardingStatus: null,
  },
  [REVIEW_ACTIONS.REQUEST_INFO]: {
    allowedFrom: IN_REVIEW_STATUSES,
    nextStatus: APPLICATION_STATUS.NEEDS_INFORMATION,
    userOnboardingStatus: ONBOARDING_STATUS.IN_PROGRESS,
  },
  [REVIEW_ACTIONS.APPROVE]: {
    allowedFrom: IN_REVIEW_STATUSES,
    nextStatus: APPLICATION_STATUS.APPROVED,
    userOnboardingStatus: ONBOARDING_STATUS.APPROVED,
  },
  [REVIEW_ACTIONS.REJECT]: {
    allowedFrom: IN_REVIEW_STATUSES,
    nextStatus: APPLICATION_STATUS.REJECTED,
    userOnboardingStatus: ONBOARDING_STATUS.REJECTED,
  },
});

export const listApplicationsForReview = async (query) => {
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

export const getApplicationForReview = async (applicationId) => {
  const app = await doctorApplicationRepository.findById(applicationId);
  if (!app) throw new ApiError(404, 'Doctor application not found', 'APPLICATION_NOT_FOUND');

  const nmcLookups = await nmcLookupRepository.findByApplicationId(app._id);
  return {
    application: toPublicApplication(app),
    nmcLookups,
  };
};

export const reviewApplication = async (adminUser, applicationId, { action, notes, reason }) => {
  const spec = REVIEW_TRANSITIONS[action];
  const existing = await doctorApplicationRepository.findById(applicationId);
  if (!existing) throw new ApiError(404, 'Doctor application not found', 'APPLICATION_NOT_FOUND');

  if (!spec.allowedFrom.includes(existing.applicationStatus)) {
    throw new ApiError(
      409,
      `Cannot perform ${action} on an application in ${existing.applicationStatus} status`,
      'INVALID_APPLICATION_TRANSITION'
    );
  }

  const now = new Date();
  const set = {
    applicationStatus: spec.nextStatus,
    reviewedBy: adminUser._id,
    reviewedAt: now,
  };

  if (notes !== undefined) set.reviewNotes = notes;
  if (action === REVIEW_ACTIONS.REQUEST_INFO) {
    set.requestedChanges = notes || reason;
    set.rejectionReason = null;
  } else if (action === REVIEW_ACTIONS.REJECT) {
    set.rejectionReason = reason || notes;
  } else if (action === REVIEW_ACTIONS.APPROVE) {
    set.requestedChanges = null;
    set.rejectionReason = null;
  }

  const updated = await doctorApplicationRepository.reviewTransition(applicationId, spec.allowedFrom, set);
  if (!updated) {
    throw new ApiError(409, 'Application state changed concurrently; refresh and retry', 'INVALID_APPLICATION_TRANSITION');
  }

  let doctor = null;
  if (action === REVIEW_ACTIONS.APPROVE) {
    doctor = await doctorRepository.upsertFromApplication(updated, adminUser._id, now);
  }

  if (spec.userOnboardingStatus) {
    await markOnboardingStatusByUserId(updated.userId, spec.userOnboardingStatus);
  }

  return {
    application: toPublicApplication(updated),
    doctor,
  };
};
