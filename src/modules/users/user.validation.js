import { z } from 'zod';
import { PUBLIC_ACCOUNT_TYPES } from './user.constants.js';

/**
 * Only `accountType` is read. Any other field (clerkUserId, email, role, ...)
 * is stripped and never trusted.
 */
export const onboardBodySchema = z.object({
  accountType: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toUpperCase() : v),
    z.enum(PUBLIC_ACCOUNT_TYPES, { message: `accountType must be one of: ${PUBLIC_ACCOUNT_TYPES.join(', ')}` })
  ),
});

const name = z.string().trim().min(1, 'Must not be empty').max(50);

/** Strict: unknown fields (role, accountStatus, ...) are rejected, not silently ignored. */
export const updateMeBodySchema = z
  .object({
    firstName: name.optional(),
    lastName: name.optional(),
    phoneNumber: z
      .string()
      .trim()
      .regex(/^\+[1-9]\d{6,14}$/, 'Phone number must be in E.164 format, e.g. +919876543210')
      .optional(),
    preferences: z
      .object({
        language: z.string().trim().min(2).max(10).optional(),
        timezone: z.string().trim().min(1).max(64).optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine((b) => Object.keys(b).length > 0, { message: 'At least one field must be provided' });
