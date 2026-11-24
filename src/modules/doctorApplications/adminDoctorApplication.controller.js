import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { toPublicDoctor } from '../doctors/doctor.service.js';
import {
  getApplicationForReview,
  listApplicationsForReview,
  reviewApplication,
} from './adminDoctorApplication.service.js';

export const listReviewQueue = asyncHandler(async (req, res) => {
  const result = await listApplicationsForReview(req.query);
  res.json(new ApiResponse(result, 'Doctor applications retrieved'));
});

export const getReviewApplication = asyncHandler(async (req, res) => {
  const result = await getApplicationForReview(req.params.id);
  res.json(new ApiResponse(result, 'Doctor application details retrieved'));
});

export const postReviewDecision = asyncHandler(async (req, res) => {
  const { application, doctor } = await reviewApplication(req.currentUser, req.params.id, req.body);
  const data = doctor ? { application, doctor: toPublicDoctor(doctor) } : { application };
  res.json(new ApiResponse(data, 'Doctor application reviewed'));
});
