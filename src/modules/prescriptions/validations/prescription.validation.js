import { z } from 'zod';
import { PRESCRIPTION_STATUS } from '../prescription.constants.js';

const trimStr = (max) => z.string().trim().min(1).max(max);

const medicineItemSchema = z
  .object({
    medicineName: trimStr(200),
    genericName: z.string().trim().max(200).optional(),
    strength: z.string().trim().max(100).optional(),
    dosageForm: z.string().trim().max(100).optional(),
    dose: trimStr(100),
    route: z.string().trim().max(100).optional(),
    frequency: trimStr(100),
    duration: trimStr(100),
    quantity: z.number().int().min(1).max(10000).optional(),
    instructions: z.string().trim().max(500).optional(),
  })
  .strict();

export const prescriptionIdParamSchema = z.object({ id: trimStr(64) }).strict();

export const createPrescriptionBodySchema = z
  .object({
    appointmentId: trimStr(64),
    diagnosis: z.string().trim().max(500).optional(),
    clinicalNotes: z.string().trim().max(2000).optional(),
    medicines: z.array(medicineItemSchema).min(1).max(30),
    generalInstructions: z.string().trim().max(1000).optional(),
  })
  .strict();

export const updatePrescriptionDraftBodySchema = z
  .object({
    diagnosis: z.string().trim().max(500).optional(),
    clinicalNotes: z.string().trim().max(2000).optional(),
    medicines: z.array(medicineItemSchema).min(1).max(30).optional(),
    generalInstructions: z.string().trim().max(1000).optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: 'At least one field must be provided' });

export const amendPrescriptionBodySchema = z
  .object({
    reason: trimStr(500),
    diagnosis: z.string().trim().max(500).optional(),
    clinicalNotes: z.string().trim().max(2000).optional(),
    medicines: z.array(medicineItemSchema).min(1).max(30).optional(),
    generalInstructions: z.string().trim().max(1000).optional(),
  })
  .strict();

export const voidPrescriptionBodySchema = z
  .object({
    reason: trimStr(500),
  })
  .strict();

export const listPrescriptionsQuerySchema = z
  .object({
    status: z.enum(Object.values(PRESCRIPTION_STATUS)).optional(),
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();
