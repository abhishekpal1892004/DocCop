import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  bookFollowUpAppointment,
  createFollowUpRecommendation,
  listDoctorFollowUps,
  listPatientFollowUps,
  updateFollowUpStatus,
} from './followUp.service.js';

export const postCreateFollowUp = asyncHandler(async (req, res) => {
  const followUp = await createFollowUpRecommendation(req.currentUser, req.body);
  res.status(201).json(new ApiResponse({ followUp }, 'Follow-up recommendation created'));
});

export const getMyFollowUps = asyncHandler(async (req, res) => {
  const followUps = await listPatientFollowUps(req.currentUser);
  res.json(new ApiResponse({ followUps }, 'Patient follow-ups retrieved'));
});

export const getDoctorFollowUps = asyncHandler(async (req, res) => {
  const followUps = await listDoctorFollowUps(req.currentUser);
  res.json(new ApiResponse({ followUps }, 'Doctor follow-ups retrieved'));
});

export const patchFollowUpStatus = asyncHandler(async (req, res) => {
  const followUp = await updateFollowUpStatus(req.currentUser, req.params.id, req.body);
  res.json(new ApiResponse({ followUp }, 'Follow-up status updated'));
});

export const postBookFollowUp = asyncHandler(async (req, res) => {
  const result = await bookFollowUpAppointment(req.currentUser, req.params.id, req.body);
  res.status(201).json(new ApiResponse(result, 'Follow-up appointment booked'));
});
