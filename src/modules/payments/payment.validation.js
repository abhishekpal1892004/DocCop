import { z } from 'zod';

const trimStr = (max) => z.string().trim().min(1).max(max);

export const paymentIdParamSchema = z.object({ id: trimStr(64) }).strict();

export const createOrderBodySchema = z
  .object({
    appointmentId: trimStr(64),
  })
  .strict();

export const verifyPaymentBodySchema = z
  .object({
    appointmentId: trimStr(64),
    razorpayPaymentId: trimStr(100),
    razorpaySignature: trimStr(256),
  })
  .strict();

export const refundPaymentBodySchema = z
  .object({
    reason: trimStr(500),
  })
  .strict();

export const listPaymentsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();
