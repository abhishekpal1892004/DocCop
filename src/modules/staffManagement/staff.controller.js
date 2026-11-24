import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  acceptStaffInvitation,
  inviteStaffMember,
  listClinicStaff,
  removeStaffFromClinic,
  updateStaffPermissions,
} from './staff.service.js';

export const postInviteStaff = asyncHandler(async (req, res) => {
  const result = await inviteStaffMember(req.currentUser, req.params.id, req.body);
  res.status(201).json(new ApiResponse(result, 'Staff invitation created'));
});

export const getClinicStaff = asyncHandler(async (req, res) => {
  const staff = await listClinicStaff(req.currentUser, req.params.id);
  res.json(new ApiResponse({ staff }, 'Clinic staff retrieved'));
});

export const patchStaffPermissions = asyncHandler(async (req, res) => {
  const membership = await updateStaffPermissions(req.currentUser, req.params.id, req.body);
  res.json(new ApiResponse({ membership }, 'Staff permissions updated'));
});

export const deleteClinicStaffMember = asyncHandler(async (req, res) => {
  const result = await removeStaffFromClinic(req.currentUser, req.params.id, req.params.userId);
  res.json(new ApiResponse(result, 'Staff member removed from clinic'));
});

export const postAcceptInvitation = asyncHandler(async (req, res) => {
  const result = await acceptStaffInvitation(req.identity, req.body);
  res.status(200).json(new ApiResponse(result, 'Staff invitation accepted'));
});
