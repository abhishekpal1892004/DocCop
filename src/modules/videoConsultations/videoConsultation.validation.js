import { z } from 'zod';

export const videoAppointmentIdParamSchema = z
  .object({
    appointmentId: z.string().trim().min(1).max(64),
  })
  .strict();

export const generateVideoTokenBodySchema = z
  .object({
    telemedicineConsentAccepted: z.boolean().default(true),
    emergencyNoticeAcknowledged: z.boolean().default(true),
  })
  .strict()
  .optional()
  .default({});
