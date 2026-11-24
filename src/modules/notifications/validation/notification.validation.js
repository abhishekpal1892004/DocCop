import { z } from 'zod';
import { E164_REGEX } from '../../patients/patient.constants.js';
import { PREFERRED_CHANNELS } from '../notification.constants.js';

const channelConsentInputSchema = z
  .object({
    enabled: z.boolean().optional(),
    optedIn: z.boolean().optional(),
    consentSource: z.string().trim().max(100).optional(),
    consentVersion: z.string().trim().max(32).optional(),
  })
  .strict();

export const updatePreferencesBodySchema = z
  .object({
    phoneNumber: z.string().trim().regex(E164_REGEX, 'Phone number must be in E.164 format').optional(),
    preferredChannel: z.enum(PREFERRED_CHANNELS).optional(),
    sms: channelConsentInputSchema.optional(),
    whatsapp: channelConsentInputSchema.optional(),
    inApp: z.object({ enabled: z.boolean() }).strict().optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: 'At least one field must be provided' });

export const listMyNotificationsQuerySchema = z
  .object({
    unreadOnly: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export const notificationIdParamSchema = z
  .object({
    id: z.string().trim().min(1).max(64),
  })
  .strict();
