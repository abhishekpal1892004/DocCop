export const RECORD_CATEGORIES = Object.freeze([
  'LAB_REPORT',
  'PRESCRIPTION',
  'DIAGNOSTIC_REPORT',
  'MEDICAL_HISTORY',
  'CONSULTATION_REPORT',
  'OTHER',
]);

export const RECORD_VISIBILITY = Object.freeze({
  PRIVATE: 'PRIVATE',
  SHARED: 'SHARED',
});

export const SCAN_STATUS = Object.freeze({
  PENDING_SCAN: 'PENDING_SCAN',
  CLEAN: 'CLEAN',
  INFECTED: 'INFECTED',
  UNSCANNED: 'UNSCANNED',
});

export const RECORD_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
  DELETED: 'DELETED',
});

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_MIME_TYPES = Object.freeze([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);
