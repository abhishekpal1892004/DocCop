import { z } from 'zod';
import { registrationNumberSchema, registrationYearSchema, stateCodeSchema } from '../doctorApplications/doctorApplication.validation.js';

export const nmcCheckBodySchema = z
  .object({
    name: z.string().trim().min(2, 'Name is required').max(120),
    registrationNumber: registrationNumberSchema,
    registrationYear: registrationYearSchema,
    state: stateCodeSchema,
  })
  .strict();
