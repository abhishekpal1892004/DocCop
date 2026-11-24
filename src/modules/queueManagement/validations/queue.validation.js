import { z } from 'zod';

const trimStr = (max) => z.string().trim().min(1).max(max);

export const queueIdParamSchema = z.object({ id: trimStr(64) }).strict();
export const queueEntryParamsSchema = z.object({ id: trimStr(64), entryId: trimStr(64) }).strict();

export const openQueueBodySchema = z
  .object({
    clinicId: trimStr(64).optional(),
    averageConsultationMinutes: z.number().int().min(5).max(120).default(15),
  })
  .strict()
  .optional()
  .default({});

export const checkInBodySchema = z
  .object({
    appointmentId: trimStr(64),
  })
  .strict();

export const myPositionQuerySchema = z
  .object({
    appointmentId: trimStr(64),
  })
  .strict();
