import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as patientService from './patient.service.js';

const send = (res, profile, message, statusCode = 200) =>
  ApiResponse.send(res, { statusCode, message, data: { profile: patientService.toPublicPatientProfile(profile) } });

export const createProfile = asyncHandler(async (req, res) => {
  send(res, await patientService.createProfile(req.currentUser, req.body), 'Patient profile created', 201);
});

export const getMyProfile = asyncHandler(async (req, res) => {
  send(res, await patientService.getProfile(req.currentUser), 'Request successful');
});

export const updateMyProfile = asyncHandler(async (req, res) => {
  send(res, await patientService.updateProfile(req.currentUser, req.body), 'Patient profile updated');
});
