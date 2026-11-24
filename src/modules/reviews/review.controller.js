import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  deleteMyReview,
  getDoctorReviews,
  listMyReviews,
  listReviewsForAdmin,
  moderateReviewByAdmin,
  reportReview,
  submitDoctorReview,
  updateMyReview,
} from './review.service.js';

export const postDoctorReview = asyncHandler(async (req, res) => {
  const review = await submitDoctorReview(req.currentUser, req.params.id, req.body);
  res.status(201).json(new ApiResponse({ review }, 'Review submitted'));
});

export const getPublicDoctorReviews = asyncHandler(async (req, res) => {
  const result = await getDoctorReviews(req.params.id, req.query);
  res.json(new ApiResponse(result, 'Doctor reviews retrieved'));
});

export const getMyReviews = asyncHandler(async (req, res) => {
  const result = await listMyReviews(req.currentUser, req.query);
  res.json(new ApiResponse(result, 'Patient reviews retrieved'));
});

export const patchMyReview = asyncHandler(async (req, res) => {
  const review = await updateMyReview(req.currentUser, req.params.id, req.body);
  res.json(new ApiResponse({ review }, 'Review updated'));
});

export const deleteOwnReview = asyncHandler(async (req, res) => {
  const result = await deleteMyReview(req.currentUser, req.params.id);
  res.json(new ApiResponse(result, 'Review deleted'));
});

export const postReportReview = asyncHandler(async (req, res) => {
  const review = await reportReview(req.params.id);
  res.json(new ApiResponse({ review }, 'Review reported for moderation'));
});

export const getAdminReviews = asyncHandler(async (req, res) => {
  const result = await listReviewsForAdmin(req.query);
  res.json(new ApiResponse(result, 'Reviews retrieved for moderation'));
});

export const patchModerateReview = asyncHandler(async (req, res) => {
  const review = await moderateReviewByAdmin(req.currentUser, req.params.id, req.body);
  res.json(new ApiResponse({ review }, 'Review moderation updated'));
});
