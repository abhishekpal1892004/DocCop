import express, { Router } from 'express';
import { verifyTwilioWebhookRequest } from '../integrations/twilio/twilio.webhook.service.js';
import { processTwilioStatusCallback } from '../modules/notifications/services/notificationStatus.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.post(
  '/twilio/status',
  express.urlencoded({ extended: false }),
  asyncHandler(async (req, res) => {
    verifyTwilioWebhookRequest(req);
    const result = await processTwilioStatusCallback(req.body ?? {});
    res.status(200).json(new ApiResponse(result, 'Twilio status callback processed'));
  })
);

export default router;
