import { z } from 'zod';

const MAX_RANGE_MS = 366 * 24 * 60 * 60 * 1000;

export const analyticsDateRangeQuerySchema = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    granularity: z.enum(['day', 'week', 'month']).default('day'),
    timezone: z.string().trim().min(1).max(64).default('UTC'),
    page: z.coerce.number().int().min(1).max(100).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.from && data.to) {
      if (data.to <= data.from) {
        ctx.addIssue({ code: 'custom', path: ['to'], message: 'to must be after from' });
      }
      if (data.to.getTime() - data.from.getTime() > MAX_RANGE_MS) {
        ctx.addIssue({
          code: 'custom',
          path: ['to'],
          message: 'Analytics date range cannot exceed 366 days',
        });
      }
    }
  });
