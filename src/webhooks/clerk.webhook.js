import express, { Router } from 'express';
import { verifyWebhook } from '@clerk/express/webhooks';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { handleClerkEvent } from '../modules/users/user.service.js';

const router = Router();

// Raw body is required for signature verification; mounted before express.json().
router.post(
  '/clerk',
  express.raw({ type: 'application/json', limit: '1mb' }),
  asyncHandler(async (req, res) => {
    if (!env.CLERK_WEBHOOK_SIGNING_SECRET) {
      throw new ApiError(503, 'Webhook endpoint is not configured', 'WEBHOOK_NOT_CONFIGURED');
    }

    let event;
    try {
      event = await verifyWebhook(req, { signingSecret: env.CLERK_WEBHOOK_SIGNING_SECRET });
    } catch {
      throw new ApiError(400, 'Invalid webhook signature', 'INVALID_WEBHOOK_SIGNATURE');
    }

    // Processing errors propagate as 5xx so Clerk (Svix) retries delivery.
    const outcome = await handleClerkEvent(event);
    ApiResponse.send(res, { data: { eventType: event.type, outcome }, message: 'Webhook processed' });
  })
);

export default router;
