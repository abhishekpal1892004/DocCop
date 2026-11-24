import { ApiResponse } from '../../../utils/ApiResponse.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { getAbhaStatus, initiateAbhaLink, unlinkAbha, verifyAbhaLink } from '../services/abha.service.js';

export const postInitiateAbhaLink = asyncHandler(async (req, res) => {
  const result = await initiateAbhaLink(req.currentUser, req.body, req.id ?? null);
  return ApiResponse.send(res, { statusCode: 200, data: result, message: 'ABHA verification initiated' });
});

export const postVerifyAbhaLink = asyncHandler(async (req, res) => {
  const status = await verifyAbhaLink(req.currentUser, req.body, req.id ?? null);
  return ApiResponse.send(res, { statusCode: 200, data: { abha: status }, message: 'ABHA identity verified and linked' });
});

export const getMyAbhaStatus = asyncHandler(async (req, res) => {
  const status = await getAbhaStatus(req.currentUser);
  return ApiResponse.send(res, { statusCode: 200, data: { abha: status }, message: 'ABHA status retrieved' });
});

export const deleteMyAbhaLink = asyncHandler(async (req, res) => {
  const status = await unlinkAbha(req.currentUser, req.id ?? null);
  return ApiResponse.send(res, { statusCode: 200, data: { abha: status }, message: 'ABHA link removed' });
});
