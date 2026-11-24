import { ApiResponse } from '../../../utils/ApiResponse.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import {
  amendPrescription,
  createPrescriptionDraft,
  downloadPrescriptionPdf,
  getPrescriptionById,
  issuePrescription,
  listDoctorPrescriptions,
  listPatientPrescriptions,
  updatePrescriptionDraft,
  voidPrescription,
} from '../services/prescription.service.js';

export const postCreatePrescription = asyncHandler(async (req, res) => {
  const prescription = await createPrescriptionDraft(req.currentUser, req.body, req.id);
  res.status(201).json(new ApiResponse({ prescription }, 'Prescription draft created'));
});

export const getPrescription = asyncHandler(async (req, res) => {
  const prescription = await getPrescriptionById(req.currentUser, req.params.id, req.id);
  res.json(new ApiResponse({ prescription }, 'Prescription retrieved'));
});

export const getMyPrescriptions = asyncHandler(async (req, res) => {
  const result = await listPatientPrescriptions(req.currentUser, req.query);
  res.json(new ApiResponse(result, 'Patient prescriptions retrieved'));
});

export const getDoctorPrescriptions = asyncHandler(async (req, res) => {
  const result = await listDoctorPrescriptions(req.currentUser, req.query);
  res.json(new ApiResponse(result, 'Doctor prescriptions retrieved'));
});

export const patchPrescriptionDraft = asyncHandler(async (req, res) => {
  const prescription = await updatePrescriptionDraft(req.currentUser, req.params.id, req.body);
  res.json(new ApiResponse({ prescription }, 'Prescription draft updated'));
});

export const postIssuePrescription = asyncHandler(async (req, res) => {
  const prescription = await issuePrescription(req.currentUser, req.params.id, req.id);
  res.json(new ApiResponse({ prescription }, 'Prescription issued'));
});

export const postAmendPrescription = asyncHandler(async (req, res) => {
  const prescription = await amendPrescription(req.currentUser, req.params.id, req.body, req.id);
  res.status(201).json(new ApiResponse({ prescription }, 'Prescription amended'));
});

export const postVoidPrescription = asyncHandler(async (req, res) => {
  const prescription = await voidPrescription(req.currentUser, req.params.id, req.body, req.id);
  res.json(new ApiResponse({ prescription }, 'Prescription voided'));
});

export const getPrescriptionPdf = asyncHandler(async (req, res) => {
  const { buffer, filename } = await downloadPrescriptionPdf(req.currentUser, req.params.id, req.id);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  res.send(buffer);
});
