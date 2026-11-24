import { z } from 'zod';

const trimStr = (max) => z.string().trim().min(1).max(max);

export const waitlistIdParamSchema = z.object({ id: trimStr(64) }).strict();

export const joinWaitlistBodySchema = z
  .object({
    doctorId: trimStr(64),
    appointmentTypeId: trimStr(64),
    preferredDate: z.coerce.date(),
    preferredTimeRange: z
      .object({
        start: z.string().regex(/^\d{2}:\d{2}$/).default('00:00'),
        end: z.string().regex(/^\d{2}:\d{2}$/).default('23:59'),
      })
      .strict()
      .optional(),
    timezone: trimStr(64).default('UTC'),
  })
  .strict();
