import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { completeVideoConsultation, generateConsultationToken } from './videoConsultation.service.js';

export const postConsultationToken = asyncHandler(async (req, res) => {
  const result = await generateConsultationToken(req.currentUser, req.params.appointmentId, req.body);
  res.json(new ApiResponse(result, 'Agora consultation token generated'));
});

export const postCompleteConsultation = asyncHandler(async (req, res) => {
  const result = await completeVideoConsultation(req.currentUser, req.params.appointmentId);
  res.json(new ApiResponse(result, 'Video consultation completed'));
});
