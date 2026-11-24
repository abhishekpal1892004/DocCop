import { z } from 'zod';
import { RECORD_CATEGORIES } from '../medicalRecord.constants.js';

const trimStr = (max) => z.string().trim().min(1).max(max);

export const uploadMedicalRecordBodySchema = z
  .object({
    title: trimStr(160),
    description: z.string().trim().max(1000).optional(),
    category: z.enum(RECORD_CATEGORIES),
    appointmentId: trimStr(64).optional(),
  })
  .strict();

export const listMedicalRecordsQuerySchema = z
  .object({
    category: z.enum(RECORD_CATEGORIES).optional(),
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export const medicalRecordIdParamSchema = z.object({ id: trimStr(64) }).strict();

export const revokeShareParamsSchema = z
  .object({
    id: trimStr(64),
    doctorId: trimStr(64),
  })
  .strict();

export const updateMedicalRecordBodySchema = z
  .object({
    title: trimStr(160).optional(),
    description: z.string().trim().max(1000).optional(),
    category: z.enum(RECORD_CATEGORIES).optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: 'At least one field must be provided' });

export const shareMedicalRecordBodySchema = z
  .object({
    doctorId: trimStr(64),
    allowUnscanned: z.boolean().default(false),
  })
  .strict();
