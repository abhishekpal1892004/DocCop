import { z } from 'zod';
import { REVIEW_MODERATION_STATUS } from './review.constants.js';

const trimStr = (max) => z.string().trim().min(1).max(max);

export const doctorIdReviewParamSchema = z.object({ id: trimStr(64) }).strict();
export const reviewIdParamSchema = z.object({ id: trimStr(64) }).strict();

export const createReviewBodySchema = z
  .object({
    appointmentId: trimStr(64),
    rating: z.number().int().min(1).max(5),
    reviewText: z.string().trim().max(1500).optional().default(''),
  })
  .strict();

export const updateReviewBodySchema = z
  .object({
    rating: z.number().int().min(1).max(5).optional(),
    reviewText: z.string().trim().max(1500).optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: 'At least one field must be provided' });

export const reportReviewBodySchema = z
  .object({
    reason: z.string().trim().max(500).optional(),
  })
  .strict()
  .optional()
  .default({});

export const moderateReviewBodySchema = z
  .object({
    moderationStatus: z.enum([REVIEW_MODERATION_STATUS.APPROVED, REVIEW_MODERATION_STATUS.REJECTED]),
    remarks: trimStr(500),
  })
  .strict();

export const listReviewsQuerySchema = z
  .object({
    moderationStatus: z.enum(Object.values(REVIEW_MODERATION_STATUS)).optional(),
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();
