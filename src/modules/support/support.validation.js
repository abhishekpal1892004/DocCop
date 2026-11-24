import { z } from 'zod';
import { TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES } from './supportTicket.model.js';

const trimStr = (max) => z.string().trim().min(1).max(max);

export const ticketIdParamSchema = z.object({ id: trimStr(64) }).strict();

export const createTicketBodySchema = z
  .object({
    category: z.enum(TICKET_CATEGORIES),
    priority: z.enum(TICKET_PRIORITIES).default('MEDIUM'),
    subject: trimStr(200),
    description: trimStr(4000),
    relatedAppointmentId: trimStr(64).optional(),
    relatedDoctorId: trimStr(64).optional(),
    relatedClinicId: trimStr(64).optional(),
  })
  .strict();

export const replyTicketBodySchema = z
  .object({
    message: trimStr(2000),
    isInternalNote: z.boolean().optional().default(false),
  })
  .strict();

export const adminListTicketsQuerySchema = z
  .object({
    status: z.enum(TICKET_STATUSES).optional(),
    category: z.enum(TICKET_CATEGORIES).optional(),
    priority: z.enum(TICKET_PRIORITIES).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const adminUpdateTicketBodySchema = z
  .object({
    status: z.enum(TICKET_STATUSES).optional(),
    priority: z.enum(TICKET_PRIORITIES).optional(),
    assignedAdminId: trimStr(64).nullable().optional(),
    resolutionNotes: z.string().trim().max(2000).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });
