import express, { Router } from 'express';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  processAbdmWebhookEvent,
  verifyAbdmWebhookSignature,
} from '../modules/abdm/webhooks/abdmWebhook.service.js';

const router = Router();

router.post(
  '/',
  express.raw({ type: 'application/json', limit: '200kb' }),
  asyncHandler(async (req, res) => {
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body ?? {});
    verifyAbdmWebhookSignature({
      rawBody,
      signature: req.headers['x-abdm-signature'],
      timestamp: req.headers['x-abdm-timestamp'],
    });

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new ApiError(400, 'Malformed ABDM webhook JSON payload', 'INVALID_JSON');
    }

    const result = await processAbdmWebhookEvent(payload);
    return ApiResponse.send(res, { statusCode: 200, data: result, message: 'ABDM webhook processed' });
  })
);

export default router;
