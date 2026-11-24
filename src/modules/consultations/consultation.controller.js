import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  completeConsultation,
  createConsultation,
  getConsultationById,
  listDoctorConsultations,
  listPatientConsultations,
  updateConsultation,
} from './consultation.service.js';

export const postCreateConsultation = asyncHandler(async (req, res) => {
  const consultation = await createConsultation(req.currentUser, req.body, req.id);
  res.status(201).json(new ApiResponse({ consultation }, 'Consultation record created'));
});

export const patchConsultation = asyncHandler(async (req, res) => {
  const consultation = await updateConsultation(req.currentUser, req.params.id, req.body);
  res.json(new ApiResponse({ consultation }, 'Consultation record updated'));
});

export const postCompleteConsultation = asyncHandler(async (req, res) => {
  const consultation = await completeConsultation(req.currentUser, req.params.id, req.id);
  res.json(new ApiResponse({ consultation }, 'Consultation marked completed'));
});

export const getConsultation = asyncHandler(async (req, res) => {
  const consultation = await getConsultationById(req.currentUser, req.params.id);
  res.json(new ApiResponse({ consultation }, 'Consultation record retrieved'));
});

export const getMyConsultations = asyncHandler(async (req, res) => {
  const result = await listPatientConsultations(req.currentUser, req.query);
  res.json(new ApiResponse(result, 'Patient consultations retrieved'));
});

export const getDoctorConsultations = asyncHandler(async (req, res) => {
  const result = await listDoctorConsultations(req.currentUser, req.query);
  res.json(new ApiResponse(result, 'Doctor consultations retrieved'));
});
