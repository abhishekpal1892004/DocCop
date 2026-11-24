import express, { Router } from 'express';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { processRazorpayWebhook } from './payment.service.js';

const router = Router();

router.post(
  '/',
  express.raw({ type: 'application/json', limit: '256kb' }),
  asyncHandler(async (req, res) => {
    const result = await processRazorpayWebhook({
      rawBody: req.body,
      signatureHeader: req.get('X-Razorpay-Signature'),
      eventId: req.get('x-razorpay-event-id'),
    });
    res.status(200).json(new ApiResponse(result, 'Razorpay webhook processed'));
  })
);

export default router;
