export const ROLES = Object.freeze({
  PATIENT: 'PATIENT',
  DOCTOR: 'DOCTOR',
  ADMIN: 'ADMIN',
  CLINIC_MANAGER: 'CLINIC_MANAGER',
  RECEPTIONIST: 'RECEPTIONIST',
});

/** Roles a person may choose during public signup. ADMIN and staff roles are never public. */
export const PUBLIC_ACCOUNT_TYPES = Object.freeze([ROLES.PATIENT, ROLES.DOCTOR]);

export const ACCOUNT_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  DEACTIVATED: 'DEACTIVATED',
});

export const ONBOARDING_STATUS = Object.freeze({
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  PENDING_VERIFICATION: 'PENDING_VERIFICATION',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
});

/** Minimum interval between lastLoginAt writes, to avoid a DB write on every request. */
export const LAST_LOGIN_THROTTLE_MS = 5 * 60 * 1000;
