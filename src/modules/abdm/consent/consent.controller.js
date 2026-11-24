import { ApiResponse } from '../../../utils/ApiResponse.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { getConsentById, listMyConsents, requestAbdmConsent, revokeAbdmConsent } from './consent.service.js';

export const postHiuConsentRequest = asyncHandler(async (req, res) => {
  const consent = await requestAbdmConsent(req.currentUser, req.body, req.id ?? null);
  return ApiResponse.send(res, { statusCode: 201, data: { consent }, message: 'Consent request initiated' });
});

export const getHiuConsent = asyncHandler(async (req, res) => {
  const consent = await getConsentById(req.currentUser, req.params.id);
  return ApiResponse.send(res, { statusCode: 200, data: { consent }, message: 'Consent retrieved' });
});

export const getMyHiuConsents = asyncHandler(async (req, res) => {
  const consents = await listMyConsents(req.currentUser);
  return ApiResponse.send(res, { statusCode: 200, data: { consents }, message: 'Consents retrieved' });
});

export const postHiuConsentRevoke = asyncHandler(async (req, res) => {
  const consent = await revokeAbdmConsent(req.currentUser, req.params.id, req.id ?? null);
  return ApiResponse.send(res, { statusCode: 200, data: { consent }, message: 'Consent revoked' });
});
