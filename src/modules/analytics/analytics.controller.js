import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  getAnalyticsOverview,
  getAppointmentAnalytics,
  getClinicAnalytics,
  getDoctorAnalytics,
  getUserGrowthAnalytics,
} from './analytics.service.js';

export const getOverview = asyncHandler(async (_req, res) => {
  const overview = await getAnalyticsOverview();
  res.json(new ApiResponse({ overview }, 'Admin analytics overview retrieved'));
});

export const getAppointments = asyncHandler(async (req, res) => {
  const analytics = await getAppointmentAnalytics(req.query);
  res.json(new ApiResponse({ analytics }, 'Appointment analytics retrieved'));
});

export const getUsers = asyncHandler(async (req, res) => {
  const analytics = await getUserGrowthAnalytics(req.query);
  res.json(new ApiResponse({ analytics }, 'User growth analytics retrieved'));
});

export const getDoctors = asyncHandler(async (req, res) => {
  const analytics = await getDoctorAnalytics(req.query);
  res.json(new ApiResponse({ analytics }, 'Doctor analytics retrieved'));
});

export const getClinics = asyncHandler(async (req, res) => {
  const analytics = await getClinicAnalytics(req.query);
  res.json(new ApiResponse({ analytics }, 'Clinic analytics retrieved'));
});
