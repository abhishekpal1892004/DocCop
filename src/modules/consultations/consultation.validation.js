import { z } from 'zod';

const trimStr = (max) => z.string().trim().min(1).max(max);

export const consultationIdParamSchema = z.object({ id: trimStr(64) }).strict();

export const createConsultationBodySchema = z
  .object({
    appointmentId: trimStr(64),
    notes: z.string().trim().max(4000).optional(),
    followUpInstructions: z.string().trim().max(1000).optional(),
  })
  .strict();

export const updateConsultationBodySchema = z
  .object({
    notes: z.string().trim().max(4000).optional(),
    followUpInstructions: z.string().trim().max(1000).optional(),
    prescriptionIds: z.array(trimStr(64)).max(20).optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: 'At least one field must be provided' });

export const listConsultationsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();
