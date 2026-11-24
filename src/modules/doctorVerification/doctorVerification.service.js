import { ApiError } from '../../utils/ApiError.js';
import { nmcClient, NmcProviderError } from '../../integrations/nmc/nmc.client.js';
import { evaluateLookup, normalizeRegistrationNumber, nameTokens } from '../../integrations/nmc/nmc.matcher.js';
import {
  LOOKUP_STATUS,
  NMC_PROVIDER_NAME,
  STATE_COUNCILS,
  getCouncilName,
  isSupportedState,
  normalizeStateCode,
} from '../../integrations/nmc/nmc.constants.js';
import { doctorApplicationRepository } from '../doctorApplications/doctorApplication.repository.js';
import { EDITABLE_STATUSES, NMC_VERIFICATION_STATUS } from '../doctorApplications/doctorApplication.constants.js';
import { nmcLookupRepository } from './nmcLookup.repository.js';

export const MAX_LOOKUPS_PER_APPLICATION_PER_DAY = 15;

/** Lookup status -> status stored on the application. Never an approval. */
const toApplicationNmcStatus = {
  [LOOKUP_STATUS.MATCH_FOUND]: NMC_VERIFICATION_STATUS.LOOKUP_COMPLETED,
  [LOOKUP_STATUS.PARTIAL_MATCH]: NMC_VERIFICATION_STATUS.MANUAL_REVIEW_REQUIRED,
  [LOOKUP_STATUS.NO_MATCH]: NMC_VERIFICATION_STATUS.NO_MATCH,
  [LOOKUP_STATUS.PROVIDER_UNAVAILABLE]: NMC_VERIFICATION_STATUS.PROVIDER_UNAVAILABLE,
  [LOOKUP_STATUS.MANUAL_REVIEW_REQUIRED]: NMC_VERIFICATION_STATUS.MANUAL_REVIEW_REQUIRED,
};

export const listSupportedStates = () =>
  Object.entries(STATE_COUNCILS).map(([code, councilName]) => ({ code, councilName }));

/** Called when registration fields change: earlier lookups no longer describe the application. */
export const invalidateLookups = (applicationId) => nmcLookupRepository.supersedeForApplication(applicationId, new Date());

const sameName = (a, b) => nameTokens(a).join(' ') === nameTokens(b).join(' ');

/** The lookup must be about the logged-in doctor's own saved registration details. */
const assertMatchesSavedApplication = (application, input) => {
  const saved = application.medicalRegistration ?? {};
  const consistent =
    normalizeRegistrationNumber(saved.registrationNumber) === normalizeRegistrationNumber(input.registrationNumber) &&
    Number(saved.registrationYear) === Number(input.registrationYear) &&
    normalizeStateCode(saved.stateCode) === normalizeStateCode(input.state) &&
    sameName(application.personalDetails?.fullName, input.name);
  if (!consistent) {
    throw new ApiError(
      409,
      'The details do not match your saved application. Save your personal and registration details first, then run the check.',
      'REGISTRATION_DETAILS_MISMATCH'
    );
  }
};

const toPublicRecord = ({ record, comparison }) => ({
  name: record.name,
  registrationNumber: record.registrationNumber,
  registrationYear: record.registrationYear,
  stateCode: record.stateCode,
  councilName: record.councilName,
  qualification: record.qualification,
  qualificationYear: record.qualificationYear,
  university: record.university,
  removedStatus: record.removedStatus,
  comparison,
});

const runLookup = async (application, input) => {
  if (application.professionalDetails?.medicalSystem && application.professionalDetails.medicalSystem !== 'MODERN_MEDICINE') {
    return {
      lookupStatus: LOOKUP_STATUS.MANUAL_REVIEW_REQUIRED,
      summary: 'The NMC register covers modern medicine only. Practitioners of other systems are registered with other councils and require manual review; this is not an indication of any problem.',
      results: [],
    };
  }
  if (!isSupportedState(input.state)) {
    return {
      lookupStatus: LOOKUP_STATUS.MANUAL_REVIEW_REQUIRED,
      summary: 'Automated lookup is not configured for this state council. Manual review is required.',
      results: [],
    };
  }

  try {
    const { records } = await nmcClient.search({
      name: input.name,
      registrationNumber: input.registrationNumber,
      registrationYear: input.registrationYear,
      state: normalizeStateCode(input.state),
    });
    return evaluateLookup(input, records);
  } catch (err) {
    if (err instanceof NmcProviderError) {
      // Technical details stay in server logs only.
      console.error(`[nmc] lookup failed: ${err.reason}${err.detail ? ` (${err.detail})` : ''}`);
      return {
        lookupStatus: LOOKUP_STATUS.PROVIDER_UNAVAILABLE,
        summary: 'The medical register could not be reached right now. Your application can still be submitted for manual verification.',
        results: [],
      };
    }
    throw err;
  }
};

export const checkNmc = async (user, input) => {
  const application = await doctorApplicationRepository.findByUserId(user._id);
  if (!application) throw new ApiError(404, 'Create your doctor application first', 'APPLICATION_NOT_FOUND');
  if (!EDITABLE_STATUSES.includes(application.applicationStatus)) {
    throw new ApiError(409, 'The application can no longer be edited', 'APPLICATION_LOCKED');
  }
  assertMatchesSavedApplication(application, input);

  const since = new Date(Date.now() - 24 * 3600 * 1000);
  if ((await nmcLookupRepository.countSince(application._id, since)) >= MAX_LOOKUPS_PER_APPLICATION_PER_DAY) {
    throw new ApiError(429, 'Daily lookup limit reached for this application. Submit for manual verification instead.', 'LOOKUP_LIMIT_REACHED');
  }

  const outcome = await runLookup(application, input);
  const checkedAt = new Date();

  await nmcLookupRepository.supersedeForApplication(application._id, checkedAt);
  const lookup = await nmcLookupRepository.create({
    applicationId: application._id,
    userId: user._id,
    provider: NMC_PROVIDER_NAME,
    searchParams: {
      name: input.name,
      registrationNumber: input.registrationNumber,
      registrationYear: input.registrationYear,
      state: normalizeStateCode(input.state),
    },
    lookupStatus: outcome.lookupStatus,
    matchedRecords: outcome.results.map(({ record, comparison }) => ({ ...record, comparison })),
    resultCount: outcome.results.length,
    summary: outcome.summary,
    manualReviewRequired: true,
    checkedAt,
  });

  const updated = await doctorApplicationRepository.update(
    user._id,
    { nmcVerificationStatus: toApplicationNmcStatus[outcome.lookupStatus], latestNmcLookupId: lookup._id, nmcCheckedAt: checkedAt },
    EDITABLE_STATUSES
  );
  if (!updated) throw new ApiError(409, 'The application can no longer be edited', 'APPLICATION_LOCKED');

  return {
    verificationId: String(lookup._id),
    lookupStatus: outcome.lookupStatus,
    matchFound: outcome.lookupStatus === LOOKUP_STATUS.MATCH_FOUND,
    manualReviewRequired: true, // a lookup is never a final approval
    summary: outcome.summary,
    councilName: getCouncilName(input.state),
    matchedRecords: outcome.results.map(toPublicRecord),
    checkedAt,
  };
};
