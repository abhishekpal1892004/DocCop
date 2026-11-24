import { env } from '../../../config/env.js';
import { ApiError } from '../../../utils/ApiError.js';
import { appointmentRepository } from '../../appointments/appointment.repository.js';
import { AUDIT_ACTIONS, AUDIT_TARGET_TYPES } from '../../auditLogs/auditLog.constants.js';
import { recordAuditEvent } from '../../auditLogs/auditLog.service.js';
import { doctorRepository } from '../../doctors/doctor.repository.js';
import { ROLES } from '../../users/user.constants.js';
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  RECORD_STATUS,
  RECORD_VISIBILITY,
  SCAN_STATUS,
} from '../medicalRecord.constants.js';
import { medicalRecordRepository } from '../medicalRecord.repository.js';
import { detectFileSignatureMime, documentEncryptionService } from './documentEncryption.service.js';
import { documentStorageService } from './documentStorage.service.js';
import { assertCanAccessMedicalRecord } from './recordAccess.service.js';

export const malwareScanner = {
  async scan(_buffer) {
    if (!env.CLAMAV_SCAN_ENABLED) {
      return SCAN_STATUS.UNSCANNED;
    }
    // Extensible hook for ClamAV daemon integration when enabled.
    return SCAN_STATUS.UNSCANNED;
  },
};

export const toPublicMedicalRecord = (r) => ({
  id: String(r._id),
  patientId: String(r.patientId),
  uploadedBy: String(r.uploadedBy),
  appointmentId: r.appointmentId ? String(r.appointmentId) : null,
  title: r.title,
  description: r.description ?? '',
  category: r.category,
  file: {
    originalName: r.file?.originalName,
    mimeType: r.file?.mimeType,
    fileSize: r.file?.fileSize,
    checksum: r.file?.checksum,
  },
  visibility: r.visibility,
  scanStatus: r.scanStatus,
  recordStatus: r.recordStatus,
  uploadedAt: r.uploadedAt,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

export const uploadMedicalRecord = async (user, file, input, requestId) => {
  if (!file || !Buffer.isBuffer(file.buffer)) {
    throw new ApiError(400, 'Medical document file is required', 'FILE_REQUIRED');
  }
  if (file.size > MAX_FILE_SIZE_BYTES || file.buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new ApiError(400, 'File exceeds maximum allowed size of 10 MB', 'FILE_TOO_LARGE');
  }

  const detectedMime = detectFileSignatureMime(file.buffer);
  if (!detectedMime || !ALLOWED_MIME_TYPES.includes(detectedMime)) {
    throw new ApiError(
      400,
      'Invalid or unsupported file signature. Allowed formats: PDF, JPG, JPEG, PNG',
      'INVALID_FILE_SIGNATURE'
    );
  }

  let patientId = user._id;
  if (user.role === ROLES.DOCTOR) {
    if (!input.appointmentId) {
      throw new ApiError(400, 'appointmentId is required when a doctor uploads a consultation document', 'APPOINTMENT_REQUIRED');
    }
    const doctor = await doctorRepository.findByUserId(user._id);
    const appt = await appointmentRepository.findById(input.appointmentId);
    if (!doctor || !appt || String(appt.doctorId) !== String(doctor._id)) {
      throw new ApiError(403, 'You can only upload consultation documents for your own appointments', 'FORBIDDEN');
    }
    patientId = appt.patientId;
  }

  const scanStatus = await malwareScanner.scan(file.buffer);
  if (scanStatus === SCAN_STATUS.INFECTED) {
    throw new ApiError(422, 'Uploaded document failed security scan and was quarantined', 'FILE_INFECTED');
  }

  const encrypted = documentEncryptionService.encryptBuffer(file.buffer);
  const gridFsFileId = await documentStorageService.uploadEncryptedBuffer(encrypted.encryptedBuffer, {
    patientId: String(patientId),
    mimeType: detectedMime,
    keyVersion: encrypted.encryptionKeyVersion,
  });

  const record = await medicalRecordRepository.create({
    patientId,
    uploadedBy: user._id,
    appointmentId: input.appointmentId ?? null,
    title: input.title,
    description: input.description ?? '',
    category: input.category,
    file: {
      gridFsFileId,
      originalName: String(file.originalname || 'document').slice(0, 255),
      mimeType: detectedMime,
      fileSize: file.buffer.length,
      checksum: encrypted.checksum,
      encryptionKeyVersion: encrypted.encryptionKeyVersion,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
    },
    visibility: RECORD_VISIBILITY.PRIVATE,
    scanStatus,
    recordStatus: RECORD_STATUS.ACTIVE,
    uploadedAt: new Date(),
  });

  await recordAuditEvent({
    actorUserId: user._id,
    actorRole: user.role,
    action: AUDIT_ACTIONS.MEDICAL_RECORD_UPLOADED,
    targetType: AUDIT_TARGET_TYPES.MEDICAL_RECORD,
    targetId: record._id,
    requestId,
    metadata: { category: record.category, scanStatus: record.scanStatus },
  });

  return toPublicMedicalRecord(record);
};

export const listMyMedicalRecords = async (user, query) => {
  const result = await medicalRecordRepository.listByPatient(user._id, query);
  return {
    records: result.items.map(toPublicMedicalRecord),
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / result.limit) || 0,
    },
  };
};

export const getMedicalRecordMetadata = async (user, id, requestId) => {
  const record = await medicalRecordRepository.findById(id);
  await assertCanAccessMedicalRecord(user, record, requestId);

  await recordAuditEvent({
    actorUserId: user._id,
    actorRole: user.role,
    action: AUDIT_ACTIONS.MEDICAL_RECORD_ACCESSED,
    targetType: AUDIT_TARGET_TYPES.MEDICAL_RECORD,
    targetId: record._id,
    requestId,
    metadata: { mode: 'METADATA' },
  });

  return toPublicMedicalRecord(record);
};

export const downloadMedicalRecordFile = async (user, id, requestId) => {
  const record = await medicalRecordRepository.findById(id);
  await assertCanAccessMedicalRecord(user, record, requestId);

  const encryptedBuffer = await documentStorageService.downloadEncryptedBuffer(record.file.gridFsFileId);
  const plaintext = documentEncryptionService.decryptBuffer(encryptedBuffer, {
    encryptionKeyVersion: record.file.encryptionKeyVersion,
    iv: record.file.iv,
    authTag: record.file.authTag,
  });

  await recordAuditEvent({
    actorUserId: user._id,
    actorRole: user.role,
    action: AUDIT_ACTIONS.MEDICAL_RECORD_ACCESSED,
    targetType: AUDIT_TARGET_TYPES.MEDICAL_RECORD,
    targetId: record._id,
    requestId,
    metadata: { mode: 'DOWNLOAD' },
  });

  return {
    buffer: plaintext,
    mimeType: record.file.mimeType,
    originalName: record.file.originalName,
  };
};

export const updateMedicalRecordMetadata = async (user, id, input) => {
  const record = await medicalRecordRepository.findById(id);
  if (!record || record.recordStatus !== RECORD_STATUS.ACTIVE) {
    throw new ApiError(404, 'Medical record not found', 'MEDICAL_RECORD_NOT_FOUND');
  }
  if (String(record.patientId) !== String(user._id)) {
    throw new ApiError(403, 'Only the patient can update their medical record metadata', 'FORBIDDEN');
  }
  const updated = await medicalRecordRepository.updateById(id, input);
  return toPublicMedicalRecord(updated);
};

export const archiveMedicalRecord = async (user, id, requestId) => {
  const record = await medicalRecordRepository.findById(id);
  if (!record || record.recordStatus === RECORD_STATUS.DELETED) {
    throw new ApiError(404, 'Medical record not found', 'MEDICAL_RECORD_NOT_FOUND');
  }
  if (String(record.patientId) !== String(user._id)) {
    throw new ApiError(403, 'Only the patient can archive their medical record', 'FORBIDDEN');
  }
  const updated = await medicalRecordRepository.updateById(id, { recordStatus: RECORD_STATUS.ARCHIVED });

  await recordAuditEvent({
    actorUserId: user._id,
    actorRole: user.role,
    action: AUDIT_ACTIONS.MEDICAL_RECORD_ARCHIVED,
    targetType: AUDIT_TARGET_TYPES.MEDICAL_RECORD,
    targetId: record._id,
    requestId,
  });

  return toPublicMedicalRecord(updated);
};

export const shareMedicalRecordWithDoctor = async (user, id, { doctorId, allowUnscanned }, requestId) => {
  const record = await medicalRecordRepository.findById(id);
  if (!record || record.recordStatus !== RECORD_STATUS.ACTIVE) {
    throw new ApiError(404, 'Medical record not found', 'MEDICAL_RECORD_NOT_FOUND');
  }
  if (String(record.patientId) !== String(user._id)) {
    throw new ApiError(403, 'Only the patient can share their medical record', 'FORBIDDEN');
  }
  if (record.scanStatus === SCAN_STATUS.INFECTED) {
    throw new ApiError(422, 'Infected documents cannot be shared', 'DOCUMENT_QUARANTINED');
  }
  if (record.scanStatus === SCAN_STATUS.UNSCANNED && !allowUnscanned) {
    throw new ApiError(
      422,
      'This document has not been scanned for malware. Confirm allowUnscanned to share anyway.',
      'DOCUMENT_UNSCANNED'
    );
  }

  const doctor = await doctorRepository.findById(doctorId);
  if (!doctor || !doctor.isVerified || doctor.profileStatus !== 'PUBLISHED') {
    throw new ApiError(404, 'Approved doctor not found', 'DOCTOR_NOT_FOUND');
  }

  const access = await medicalRecordRepository.upsertAccess({
    recordId: record._id,
    patientId: user._id,
    doctorId: doctor._id,
    doctorUserId: doctor.userId,
    grantedBy: user._id,
  });

  await medicalRecordRepository.updateById(record._id, { visibility: RECORD_VISIBILITY.SHARED });

  await recordAuditEvent({
    actorUserId: user._id,
    actorRole: user.role,
    action: AUDIT_ACTIONS.MEDICAL_RECORD_SHARED,
    targetType: AUDIT_TARGET_TYPES.MEDICAL_RECORD,
    targetId: record._id,
    requestId,
    metadata: { doctorId: String(doctor._id) },
  });

  return access;
};

export const revokeMedicalRecordShare = async (user, id, doctorId, requestId) => {
  const record = await medicalRecordRepository.findById(id);
  if (!record || record.recordStatus !== RECORD_STATUS.ACTIVE) {
    throw new ApiError(404, 'Medical record not found', 'MEDICAL_RECORD_NOT_FOUND');
  }
  if (String(record.patientId) !== String(user._id)) {
    throw new ApiError(403, 'Only the patient can revoke sharing', 'FORBIDDEN');
  }

  const revoked = await medicalRecordRepository.revokeAccess(record._id, doctorId);
  if (!revoked) {
    throw new ApiError(404, 'Active sharing permission not found', 'ACCESS_NOT_FOUND');
  }

  await recordAuditEvent({
    actorUserId: user._id,
    actorRole: user.role,
    action: AUDIT_ACTIONS.MEDICAL_RECORD_SHARE_REVOKED,
    targetType: AUDIT_TARGET_TYPES.MEDICAL_RECORD,
    targetId: record._id,
    requestId,
    metadata: { doctorId: String(doctorId) },
  });

  return revoked;
};
