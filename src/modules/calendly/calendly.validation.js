import { z } from 'zod';
import { CONSULTATION_MODES } from './calendly.constants.js';

const trimStr = (max) => z.string().trim().min(1).max(max);

export const oauthCallbackQuerySchema = z
  .object({
    code: trimStr(512),
    state: trimStr(256),
  })
  .strict();

export const selectEventTypeBodySchema = z
  .object({
    calendlyEventTypeUri: z.string().trim().url().max(500),
    name: trimStr(120).optional(),
    description: z.string().trim().max(1000).optional(),
    consultationFee: z.number().min(0).max(100000),
    consultationMode: z.enum(CONSULTATION_MODES).default('IN_PERSON'),
  })
  .strict();

export const createAppointmentTypeBodySchema = selectEventTypeBodySchema;

export const updateAppointmentTypeBodySchema = z
  .object({
    name: trimStr(120).optional(),
    description: z.string().trim().max(1000).optional(),
    consultationFee: z.number().min(0).max(100000).optional(),
    consultationMode: z.enum(CONSULTATION_MODES).optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: 'At least one field is required' });

export const updateAppointmentTypeStatusSchema = z
  .object({
    isActive: z.boolean(),
  })
  .strict();

export const appointmentTypeIdParamSchema = z.object({ id: trimStr(64) }).strict();

export const availabilityQuerySchema = z
  .object({
    appointmentTypeId: trimStr(64),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    timezone: trimStr(64).default('UTC'),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.endDate <= data.startDate) {
      ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'endDate must be after startDate' });
    }
    const maxSpanMs = 93 * 24 * 60 * 60 * 1000;
    if (data.endDate.getTime() - data.startDate.getTime() > maxSpanMs) {
      ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'Date range cannot exceed 93 days' });
    }
  });
