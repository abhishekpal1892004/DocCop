import { ApiError } from '../../utils/ApiError.js';
import { markOnboardingStatus } from '../users/user.service.js';
import { ONBOARDING_STATUS } from '../users/user.constants.js';
import { patientRepository } from './patient.repository.js';

export const toPublicPatientProfile = (p) => ({
  id: String(p._id),
  dateOfBirth: p.dateOfBirth ?? null,
  gender: p.gender ?? null,
  phoneNumber: p.phoneNumber ?? null,
  address: p.address ?? null,
  emergencyContact: p.emergencyContact ?? null,
  profileCompleted: p.profileCompleted,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
});

/** Flatten a nested partial object into Mongo dot-paths so untouched sibling fields survive. */
const flatten = (obj, prefix = '') =>
  Object.entries(obj).reduce((acc, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !(value instanceof Date)) Object.assign(acc, flatten(value, path));
    else acc[path] = value;
    return acc;
  }, {});

export const createProfile = async (user, input) => {
  const existing = await patientRepository.findByUserId(user._id);
  if (existing) {
    // Heal a previous partial failure (profile saved, user status not updated), then report the duplicate.
    await markOnboardingStatus(user.clerkUserId, ONBOARDING_STATUS.COMPLETED);
    throw new ApiError(409, 'Patient profile already exists', 'PROFILE_ALREADY_EXISTS');
  }

  let profile;
  try {
    profile = await patientRepository.create({ ...input, userId: user._id, profileCompleted: true });
  } catch (err) {
    if (err?.code === 11000) throw new ApiError(409, 'Patient profile already exists', 'PROFILE_ALREADY_EXISTS');
    throw err;
  }

  // Only after the profile is safely saved.
  await markOnboardingStatus(user.clerkUserId, ONBOARDING_STATUS.COMPLETED);
  return profile;
};

export const getProfile = async (user) => {
  const profile = await patientRepository.findByUserId(user._id);
  if (!profile) throw new ApiError(404, 'Patient profile not found', 'PROFILE_NOT_FOUND');
  return profile;
};

export const updateProfile = async (user, input) => {
  const updated = await patientRepository.updateByUserId(user._id, flatten(input));
  if (!updated) throw new ApiError(404, 'Patient profile not found', 'PROFILE_NOT_FOUND');
  return updated;
};
