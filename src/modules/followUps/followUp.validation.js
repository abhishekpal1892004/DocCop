import { z } from 'zod';
import { FOLLOW_UP_STATUS, FOLLOW_UP_TYPES } from './followUp.model.js';

const trimStr = (max) => z.string().trim().min(1).max(max);

export const followUpIdParamSchema = z.object({ id: trimStr(64) }).strict();

export const createFollowUpBodySchema = z
  .object({
    appointmentId: trimStr(64),
    recommendedDate: z.coerce.date(),
    reason: z.string().trim().max(500).optional(),
    followUpType: z.enum(FOLLOW_UP_TYPES).default('ROUTINE'),
  })
  .strict();

export const updateFollowUpStatusBodySchema = z
  .object({
    status: z.enum([FOLLOW_UP_STATUS.COMPLETED, FOLLOW_UP_STATUS.CANCELLED]),
  })
  .strict();

export const bookFollowUpBodySchema = z
  .object({
    appointmentTypeId: trimStr(64),
    startTime: z.coerce.date(),
    timezone: trimStr(64).default('UTC'),
  })
  .strict();
