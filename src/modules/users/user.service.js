import { ApiError } from '../../utils/ApiError.js';
import { clerkGateway } from '../../integrations/clerk/clerk.gateway.js';
import { mapClerkUser, mapClerkWebhookUser } from '../../integrations/clerk/clerk.mapper.js';
import { userRepository } from './user.repository.js';
import { ACCOUNT_STATUS, LAST_LOGIN_THROTTLE_MS, ONBOARDING_STATUS, ROLES } from './user.constants.js';

const buildFullName = (firstName, lastName) => [firstName, lastName].filter(Boolean).join(' ') || undefined;

/** Whitelist serializer: internal sync fields and Clerk ids are never exposed. */
export const toPublicProfile = (user) => ({
  id: String(user._id),
  firstName: user.firstName ?? null,
  lastName: user.lastName ?? null,
  fullName: user.fullName ?? null,
  email: user.email,
  profileImage: user.profileImage ?? null,
  phoneNumber: user.phoneNumber ?? null,
  role: user.role,
  accountStatus: user.accountStatus,
  onboardingStatus: user.onboardingStatus,
  isEmailVerified: user.isEmailVerified,
  preferences: { language: user.preferences?.language ?? 'en', timezone: user.preferences?.timezone ?? null },
  lastLoginAt: user.lastLoginAt ?? null,
  createdAt: user.createdAt,
});

const fetchClerkIdentity = async (clerkUserId) => {
  try {
    return mapClerkUser(await clerkGateway.getUser(clerkUserId));
  } catch (err) {
    if (err?.status === 404) throw new ApiError(404, 'Clerk user not found', 'CLERK_USER_NOT_FOUND');
    console.error('[clerk] Failed to fetch user:', err?.message);
    throw new ApiError(502, 'Unable to reach the identity provider', 'IDENTITY_PROVIDER_ERROR');
  }
};

export const findByClerkUserId = (clerkUserId) => userRepository.findByClerkUserId(clerkUserId);

/**
 * Backend-controlled onboarding status transition (called by other modules only after their own
 * data was saved). Never reachable from a request body.
 */
export const markOnboardingStatus = (clerkUserId, status) => userRepository.setOnboardingStatus(clerkUserId, status);

export const markOnboardingStatusByUserId = (userId, status) => userRepository.setOnboardingStatusById(userId, status);

/**
 * Idempotent onboarding. Identity comes from Clerk (server-side), never from the request.
 * @returns {{ user: object, created: boolean }}
 */
export const onboardUser = async (clerkUserId, accountType) => {
  const assertSameRole = (existing) => {
    if (existing.role !== accountType) {
      throw new ApiError(409, `Account already registered with a different role`, 'ROLE_CONFLICT');
    }
  };

  const existing = await userRepository.findByClerkUserId(clerkUserId);
  if (existing) {
    assertSameRole(existing);
    return { user: existing, created: false };
  }

  const identity = await fetchClerkIdentity(clerkUserId);
  if (!identity.email) {
    throw new ApiError(422, 'The Clerk account has no email address', 'EMAIL_REQUIRED');
  }

  try {
    const user = await userRepository.create({
      ...identity,
      clerkUserId, // from the verified session, not from identity payload
      fullName: buildFullName(identity.firstName, identity.lastName),
      role: accountType,
      accountStatus: ACCOUNT_STATUS.ACTIVE,
      onboardingStatus: ONBOARDING_STATUS.NOT_STARTED,
      lastLoginAt: new Date(),
    });
    return { user, created: true };
  } catch (err) {
    if (err?.code === 11000) {
      // Concurrent request created it first: behave idempotently.
      const raced = await userRepository.findByClerkUserId(clerkUserId);
      if (raced) {
        assertSameRole(raced);
        return { user: raced, created: false };
      }
    }
    throw err;
  }
};

/** Returns the profile or null when onboarding has not happened yet. */
export const getCurrentUser = async (clerkUserId) => {
  const user = await userRepository.findByClerkUserId(clerkUserId);
  if (!user) return null;

  const last = user.lastLoginAt ? new Date(user.lastLoginAt).getTime() : 0;
  if (Date.now() - last > LAST_LOGIN_THROTTLE_MS) {
    const now = new Date();
    await userRepository.touchLastLogin(clerkUserId, now);
    user.lastLoginAt = now;
  }
  return user;
};

export const updateCurrentUser = async (clerkUserId, input, current) => {
  const set = {};
  if (input.firstName !== undefined) set.firstName = input.firstName;
  if (input.lastName !== undefined) set.lastName = input.lastName;
  if (input.firstName !== undefined || input.lastName !== undefined) {
    set.fullName = buildFullName(input.firstName ?? current.firstName, input.lastName ?? current.lastName);
  }
  if (input.phoneNumber !== undefined) set.phoneNumber = input.phoneNumber;
  if (input.preferences?.language !== undefined) set['preferences.language'] = input.preferences.language;
  if (input.preferences?.timezone !== undefined) set['preferences.timezone'] = input.preferences.timezone;

  const updated = await userRepository.updateProfile(clerkUserId, set);
  if (!updated) throw new ApiError(403, 'Complete onboarding first', 'ONBOARDING_REQUIRED');
  return updated;
};

/**
 * Process a signature-verified Clerk webhook event.
 * Only Clerk-owned identity fields are synced; role/status/onboarding are never touched
 * (except the documented soft-deactivation on user.deleted).
 */
export const handleClerkEvent = async (event) => {
  switch (event.type) {
    case 'user.updated': {
      const { clerkUserId, clerkUpdatedAt, ...identity } = mapClerkWebhookUser(event.data);
      if (!clerkUserId || !identity.email || !clerkUpdatedAt) return 'ignored_incomplete';
      const fields = {
        email: identity.email.trim().toLowerCase(),
        isEmailVerified: identity.isEmailVerified,
        ...(identity.profileImage ? { profileImage: identity.profileImage } : {}),
      };
      const updated = await userRepository.syncIdentity(clerkUserId, fields, clerkUpdatedAt);
      return updated ? 'updated' : 'skipped_stale_or_unknown';
    }
    case 'user.deleted': {
      if (!event.data?.id) return 'ignored_incomplete';
      const result = await userRepository.markDeleted(event.data.id, new Date());
      return result ? 'deactivated' : 'skipped_already_deleted_or_unknown';
    }
    default:
      // user.created is intentionally not used: the role is only known at onboarding.
      return 'ignored';
  }
};

/**
 * Trusted server-side only: promote/create an ADMIN. Not reachable from any HTTP route.
 * Verifies the Clerk account exists before touching MongoDB.
 */
export const provisionAdmin = async (clerkUserId) => {
  const identity = await fetchClerkIdentity(clerkUserId);
  if (!identity.email) throw new ApiError(422, 'The Clerk account has no email address', 'EMAIL_REQUIRED');
  const { clerkUserId: _id, ...rest } = identity;
  return userRepository.upsertAdmin(clerkUserId, {
    ...rest,
    fullName: buildFullName(identity.firstName, identity.lastName),
    onboardingStatus: ONBOARDING_STATUS.COMPLETED,
  });
};

export { ROLES };
