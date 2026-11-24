import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  createPaymentOrder,
  getPaymentById,
  initiatePaymentRefund,
  listMyPayments,
  verifyCheckoutPayment,
} from './payment.service.js';

export const postCreateOrder = asyncHandler(async (req, res) => {
  const result = await createPaymentOrder(req.currentUser, req.body);
  res.status(201).json(new ApiResponse(result, 'Razorpay order created'));
});

export const postVerifyPayment = asyncHandler(async (req, res) => {
  const payment = await verifyCheckoutPayment(req.currentUser, req.body);
  res.json(new ApiResponse({ payment }, 'Payment verified and confirmed'));
});

export const getMyPayments = asyncHandler(async (req, res) => {
  const result = await listMyPayments(req.currentUser, req.query);
  res.json(new ApiResponse(result, 'Payment history retrieved'));
});

export const getPayment = asyncHandler(async (req, res) => {
  const payment = await getPaymentById(req.currentUser, req.params.id);
  res.json(new ApiResponse({ payment }, 'Payment details retrieved'));
});

export const postRefundPayment = asyncHandler(async (req, res) => {
  const payment = await initiatePaymentRefund(req.currentUser, req.params.id, req.body);
  res.json(new ApiResponse({ payment }, 'Refund initiated'));
});
