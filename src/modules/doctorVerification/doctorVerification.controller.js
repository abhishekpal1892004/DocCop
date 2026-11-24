import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as verificationService from './doctorVerification.service.js';

export const nmcCheck = asyncHandler(async (req, res) => {
  const data = await verificationService.checkNmc(req.currentUser, req.body);
  ApiResponse.send(res, { data, message: 'NMC lookup completed.' });
});

export const nmcStates = asyncHandler(async (_req, res) => {
  ApiResponse.send(res, { data: { states: verificationService.listSupportedStates() } });
});
