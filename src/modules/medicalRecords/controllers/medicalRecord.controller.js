import { ApiResponse } from '../../../utils/ApiResponse.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import {
  archiveMedicalRecord,
  downloadMedicalRecordFile,
  getMedicalRecordMetadata,
  listMyMedicalRecords,
  revokeMedicalRecordShare,
  shareMedicalRecordWithDoctor,
  updateMedicalRecordMetadata,
  uploadMedicalRecord,
} from '../services/medicalRecord.service.js';

export const postUploadRecord = asyncHandler(async (req, res) => {
  const record = await uploadMedicalRecord(req.currentUser, req.file, req.body, req.id);
  res.status(201).json(new ApiResponse({ record }, 'Medical record uploaded securely'));
});

export const getMyRecords = asyncHandler(async (req, res) => {
  const result = await listMyMedicalRecords(req.currentUser, req.query);
  res.json(new ApiResponse(result, 'Medical records retrieved'));
});

export const getRecordMetadata = asyncHandler(async (req, res) => {
  const record = await getMedicalRecordMetadata(req.currentUser, req.params.id, req.id);
  res.json(new ApiResponse({ record }, 'Medical record retrieved'));
});

export const getDownloadRecord = asyncHandler(async (req, res) => {
  const { buffer, mimeType, originalName } = await downloadMedicalRecordFile(
    req.currentUser,
    req.params.id,
    req.id
  );
  const safeFilename = String(originalName || 'document').replace(/[^a-zA-Z0-9._-]/g, '_');
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  res.send(buffer);
});

export const patchRecordMetadata = asyncHandler(async (req, res) => {
  const record = await updateMedicalRecordMetadata(req.currentUser, req.params.id, req.body);
  res.json(new ApiResponse({ record }, 'Medical record updated'));
});

export const deleteArchiveRecord = asyncHandler(async (req, res) => {
  const record = await archiveMedicalRecord(req.currentUser, req.params.id, req.id);
  res.json(new ApiResponse({ record }, 'Medical record archived'));
});

export const postShareRecord = asyncHandler(async (req, res) => {
  const access = await shareMedicalRecordWithDoctor(req.currentUser, req.params.id, req.body, req.id);
  res.status(201).json(new ApiResponse({ access }, 'Medical record shared with doctor'));
});

export const deleteRevokeShare = asyncHandler(async (req, res) => {
  const access = await revokeMedicalRecordShare(
    req.currentUser,
    req.params.id,
    req.params.doctorId,
    req.id
  );
  res.json(new ApiResponse({ access }, 'Medical record sharing revoked'));
});
