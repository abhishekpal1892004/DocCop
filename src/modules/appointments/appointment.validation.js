import { z } from 'zod';

const trimStr = (max) => z.string().trim().min(1).max(max);

export const appointmentIdParamSchema = z.object({ id: trimStr(64) }).strict();

export const bookAppointmentBodySchema = z
  .object({
    doctorId: trimStr(64),
    appointmentTypeId: trimStr(64),
    startTime: z.coerce.date(),
    timezone: trimStr(64).default('UTC'),
    payOnline: z.boolean().default(false),
  })
  .strict();

export const cancelAppointmentBodySchema = z
  .object({
    reason: trimStr(500),
  })
  .strict();

export const listAppointmentsQuerySchema = z
  .object({
    tab: z.enum(['upcoming', 'past', 'cancelled', 'rescheduled', 'all']).default('all'),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    sortBy: z.enum(['asc', 'desc']).default('desc'),
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();
