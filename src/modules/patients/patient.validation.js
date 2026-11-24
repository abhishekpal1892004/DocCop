import { z } from 'zod';
import { GENDERS, E164_REGEX, MAX_AGE_YEARS, POSTAL_CODE_REGEX } from './patient.constants.js';

const text = (max) => z.string().trim().min(1, 'Must not be empty').max(max);
const phone = z.string().trim().regex(E164_REGEX, 'Phone number must be in E.164 format, e.g. +919876543210');

const dateOfBirth = z.coerce
  .date({ message: 'Invalid date of birth' })
  .refine((d) => d <= new Date(), 'Date of birth cannot be in the future')
  .refine((d) => d >= new Date(Date.now() - MAX_AGE_YEARS * 365.25 * 24 * 3600 * 1000), 'Date of birth is not plausible');

const address = z
  .object({
    street: text(200).optional(),
    city: text(100).optional(),
    state: text(100).optional(),
    country: text(100).optional(),
    pincode: z.string().trim().regex(POSTAL_CODE_REGEX, 'Invalid postal code').optional(),
  })
  .strict();

const emergencyContact = z
  .object({
    name: text(100).optional(),
    relationship: text(50).optional(),
    phoneNumber: phone.optional(),
  })
  .strict();

/** Creation requires the basics (they define "profile completed"); the rest is optional. */
export const createPatientProfileSchema = z
  .object({
    dateOfBirth,
    gender: z.enum(GENDERS),
    phoneNumber: phone,
    address: address.optional(),
    emergencyContact: emergencyContact.optional(),
  })
  .strict();

export const updatePatientProfileSchema = z
  .object({
    dateOfBirth: dateOfBirth.optional(),
    gender: z.enum(GENDERS).optional(),
    phoneNumber: phone.optional(),
    address: address.optional(),
    emergencyContact: emergencyContact.optional(),
  })
  .strict()
  .refine((b) => Object.keys(b).length > 0, { message: 'At least one field must be provided' });
