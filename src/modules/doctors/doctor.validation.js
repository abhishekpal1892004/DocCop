import { z } from 'zod';
import { CONSULTATION_MODES } from '../calendly/calendly.constants.js';
import { MEDICAL_SYSTEMS } from '../doctorApplications/doctorApplication.constants.js';

const trimStr = (max) => z.string().trim().min(1).max(max);

export const searchDoctorsQuerySchema = z
  .object({
    search: trimStr(100).optional(),
    q: trimStr(100).optional(),
    specialization: trimStr(100).optional(),
    city: trimStr(100).optional(),
    state: trimStr(100).optional(),
    clinic: trimStr(100).optional(),
    medicalSystem: z.enum(MEDICAL_SYSTEMS).optional(),
    minFee: z.coerce.number().min(0).max(100000).optional(),
    maxFee: z.coerce.number().min(0).max(100000).optional(),
    minExperience: z.coerce.number().min(0).max(70).optional(),
    consultationMode: z.enum(CONSULTATION_MODES).optional(),
    sortBy: z.enum(['experience', 'fee_asc', 'fee_desc', 'newest']).default('newest'),
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
  })
  .strict();

export const doctorIdParamSchema = z
  .object({
    id: trimStr(64),
  })
  .strict();

export const updateDoctorPracticeSchema = z
  .object({
    consultationFee: z.number().min(0).max(100000).nullable().optional(),
    bio: z.string().trim().max(1000).optional(),
    languages: z.array(trimStr(40)).max(15).optional(),
    consultationModes: z.array(z.enum(CONSULTATION_MODES)).min(1).max(3).optional(),
    isAcceptingPatients: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });
