import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  addClinicToOrganization,
  createOrganization,
  getMyOrganization,
  listOrganizationClinics,
  updateMyOrganization,
} from './organization.service.js';

export const postCreateOrganization = asyncHandler(async (req, res) => {
  const organization = await createOrganization(req.currentUser, req.body);
  res.status(201).json(new ApiResponse({ organization }, 'Organization created'));
});

export const getOwnOrganization = asyncHandler(async (req, res) => {
  const organization = await getMyOrganization(req.currentUser);
  res.json(new ApiResponse({ organization }, 'Organization retrieved'));
});

export const patchOwnOrganization = asyncHandler(async (req, res) => {
  const organization = await updateMyOrganization(req.currentUser, req.body);
  res.json(new ApiResponse({ organization }, 'Organization updated'));
});

export const postAddOrganizationClinic = asyncHandler(async (req, res) => {
  const clinic = await addClinicToOrganization(req.currentUser, req.params.id, req.body);
  res.status(201).json(new ApiResponse({ clinic }, 'Clinic added to organization'));
});

export const getOrganizationClinics = asyncHandler(async (req, res) => {
  const clinics = await listOrganizationClinics(req.currentUser, req.params.id);
  res.json(new ApiResponse({ clinics }, 'Organization clinics retrieved'));
});
