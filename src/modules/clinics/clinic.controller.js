import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  associateDoctorWithExistingClinic,
  getMyClinicAssociations,
  getPermittedClinicById,
  listVerifiedClinics,
} from './clinic.service.js';

export const getVerifiedClinics = asyncHandler(async (req, res) => {
  const result = await listVerifiedClinics(req.query);
  res.json(new ApiResponse(result, 'Verified clinics retrieved'));
});

export const postDoctorAssociation = asyncHandler(async (req, res) => {
  const result = await associateDoctorWithExistingClinic(req.currentUser, req.body);
  res.status(201).json(new ApiResponse(result, 'Clinic association submitted for verification'));
});

export const getMyAssociations = asyncHandler(async (req, res) => {
  const associations = await getMyClinicAssociations(req.currentUser);
  res.json(new ApiResponse({ associations }, 'Doctor clinic associations retrieved'));
});

export const getClinicById = asyncHandler(async (req, res) => {
  const clinic = await getPermittedClinicById(req.currentUser, req.params.id);
  res.json(new ApiResponse({ clinic }, 'Clinic retrieved'));
});
