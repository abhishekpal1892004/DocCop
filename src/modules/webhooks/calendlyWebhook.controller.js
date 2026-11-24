import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { processCalendlyWebhook } from './calendlyWebhook.service.js';

export const handleCalendlyWebhook = asyncHandler(async (req, res) => {
  const result = await processCalendlyWebhook({
    rawBody: req.body,
    signatureHeader: req.get('Calendly-Webhook-Signature'),
  });
  res.status(200).json(new ApiResponse(result, 'Calendly webhook processed'));
});
