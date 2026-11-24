import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getDoctorAvailability } from '../calendly/calendly.service.js';
import {
  getMyDoctorClinics,
  getMyDoctorProfile,
  getMyDoctorStatus,
  getVerifiedDoctorDetails,
  searchVerifiedDoctors,
  toOwnDoctorProfile,
  updateMyDoctorPractice,
} from './doctor.service.js';

export const listDoctors = asyncHandler(async (req, res) => {
  const result = await searchVerifiedDoctors(req.query);
  res.json(new ApiResponse(result, 'Verified doctors retrieved'));
});

export const getDoctorById = asyncHandler(async (req, res) => {
  const result = await getVerifiedDoctorDetails(req.params.id);
  res.json(new ApiResponse(result, 'Verified doctor retrieved'));
});

export const getAvailability = asyncHandler(async (req, res) => {
  const result = await getDoctorAvailability(req.params.id, req.query);
  res.json(new ApiResponse(result, 'Available times retrieved.'));
});

export const getMe = asyncHandler(async (req, res) => {
  const doctor = await getMyDoctorProfile(req.currentUser);
  res.json(new ApiResponse({ doctor: toOwnDoctorProfile(doctor) }, 'Doctor profile retrieved'));
});

export const updateMe = asyncHandler(async (req, res) => {
  const doctor = await updateMyDoctorPractice(req.currentUser, req.body);
  res.json(new ApiResponse({ doctor: toOwnDoctorProfile(doctor) }, 'Doctor profile updated'));
});

export const getMyClinics = asyncHandler(async (req, res) => {
  const clinics = await getMyDoctorClinics(req.currentUser);
  res.json(new ApiResponse({ clinics }, 'Doctor clinics retrieved'));
});

export const getMyStatus = asyncHandler(async (req, res) => {
  const status = await getMyDoctorStatus(req.currentUser);
  res.json(new ApiResponse({ status }, 'Doctor approval and publication status retrieved'));
});
