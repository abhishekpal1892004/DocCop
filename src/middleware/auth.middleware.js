import { clerkMiddleware, getAuth } from '@clerk/express';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { findByClerkUserId } from '../modules/users/user.service.js';
import { ACCOUNT_STATUS } from '../modules/users/user.constants.js';

/** Validates the Clerk session token on every request that passes through it. */
export const clerkAuth = clerkMiddleware({
  publishableKey: env.CLERK_PUBLISHABLE_KEY,
  secretKey: env.CLERK_SECRET_KEY,
  ...(env.CLERK_JWT_KEY ? { jwtKey: env.CLERK_JWT_KEY } : {}),
});

/** 401 unless Clerk verified a session. Sets req.identity = { clerkUserId, sessionId }. */
export const requireAuth = (req, _res, next) => {
  const { userId, sessionId } = getAuth(req);
  if (!userId) return next(ApiError.unauthorized('Authentication required', 'UNAUTHENTICATED'));
  req.identity = { clerkUserId: userId, sessionId };
  next();
};

/**
 * Loads the MongoDB user (source of truth for role/status) and rejects
 * missing-profile and non-ACTIVE accounts. Sets req.currentUser.
 */
export const requireActiveAccount = async (req, _res, next) => {
  try {
    if (!req.identity) return next(ApiError.unauthorized('Authentication required', 'UNAUTHENTICATED'));
    const user = req.currentUser ?? (await findByClerkUserId(req.identity.clerkUserId));
    if (!user) return next(ApiError.forbidden('Complete onboarding first', 'ONBOARDING_REQUIRED'));
    if (user.accountStatus !== ACCOUNT_STATUS.ACTIVE) {
      const code = user.accountStatus === ACCOUNT_STATUS.SUSPENDED ? 'ACCOUNT_SUSPENDED' : 'ACCOUNT_DEACTIVATED';
      return next(ApiError.forbidden('Your account is not active', code));
    }
    req.currentUser = user;
    next();
  } catch (err) {
    next(err);
  }
};

const roleGuard = (...allowedRoles) => (req, _res, next) =>
  allowedRoles.includes(req.currentUser?.role)
    ? next()
    : next(ApiError.forbidden('You do not have permission to access this resource', 'INSUFFICIENT_ROLE'));

/**
 * Usage: router.get('/x', requireAuth, requireRole('ADMIN'), handler)
 * The role is read from MongoDB, never from the request.
 */
export const requireRole = (...allowedRoles) => [requireActiveAccount, roleGuard(...allowedRoles)];
