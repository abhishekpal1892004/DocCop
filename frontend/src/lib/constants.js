export const ROLES = Object.freeze({
  PATIENT: 'PATIENT',
  DOCTOR: 'DOCTOR',
  ADMIN: 'ADMIN',
  CLINIC_MANAGER: 'CLINIC_MANAGER',
  RECEPTIONIST: 'RECEPTIONIST',
});

export const ROLE_LABELS = {
  PATIENT: 'Patient',
  DOCTOR: 'Doctor',
  ADMIN: 'Super Admin',
  CLINIC_MANAGER: 'Clinic Manager',
  RECEPTIONIST: 'Receptionist',
};

export const STATUS_VARIANTS = {
  CONFIRMED: { label: 'Confirmed', tone: 'success' },
  COMPLETED: { label: 'Completed', tone: 'success' },
  APPROVED: { label: 'Approved', tone: 'success' },
  ACTIVE: { label: 'Active', tone: 'success' },
  PAID: { label: 'Paid', tone: 'success' },
  ISSUED: { label: 'Issued', tone: 'success' },
  VERIFIED: { label: 'Verified', tone: 'success' },
  RESOLVED: { label: 'Resolved', tone: 'success' },
  PENDING: { label: 'Pending', tone: 'warning' },
  PENDING_PAYMENT: { label: 'Payment Pending', tone: 'warning' },
  PENDING_VERIFICATION: { label: 'Pending Verification', tone: 'warning' },
  IN_PROGRESS: { label: 'In Progress', tone: 'info' },
  UNDER_REVIEW: { label: 'Under Review', tone: 'info' },
  SCHEDULED: { label: 'Scheduled', tone: 'info' },
  DRAFT: { label: 'Draft', tone: 'neutral' },
  OPEN: { label: 'Open', tone: 'info' },
  WAITING: { label: 'Waiting', tone: 'warning' },
  CALLED: { label: 'Called', tone: 'info' },
  CANCELLED: { label: 'Cancelled', tone: 'danger' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
  SUSPENDED: { label: 'Suspended', tone: 'danger' },
  VOIDED: { label: 'Voided', tone: 'danger' },
  FAILED: { label: 'Failed', tone: 'danger' },
  NOT_STARTED: { label: 'Not Started', tone: 'neutral' },
};

export function formatDateTime(value, timeZone) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}

export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(date);
}

export function formatCurrency(amount, currency = 'INR') {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

export function getDashboardPathForRole(role) {
  switch (role) {
    case ROLES.PATIENT:
      return '/patient/dashboard';
    case ROLES.DOCTOR:
      return '/doctor/dashboard';
    case ROLES.ADMIN:
      return '/admin/dashboard';
    case ROLES.CLINIC_MANAGER:
    case ROLES.RECEPTIONIST:
      return '/clinic/dashboard';
    default:
      return '/onboarding';
  }
}
