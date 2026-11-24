import { z } from 'zod';
import { CLINIC_TYPES, PINCODE_REGEX } from '../doctorApplications/doctorApplication.constants.js';
import { E164_REGEX } from '../patients/patient.constants.js';

const trimStr = (max) => z.string().trim().min(1).max(max);

export const organizationIdParamSchema = z.object({ id: trimStr(64) }).strict();

export const createOrganizationBodySchema = z
  .object({
    name: trimStr(200),
    legalName: z.string().trim().max(200).optional(),
    organizationType: z.string().trim().max(100).optional(),
    contactEmail: z.string().trim().email().max(254).optional(),
    contactPhone: z.string().trim().regex(E164_REGEX, 'Phone number must be in E.164 format').optional(),
  })
  .strict();

export const updateOrganizationBodySchema = createOrganizationBodySchema
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: 'At least one field must be provided' });

export const addOrganizationClinicBodySchema = z
  .object({
    clinicName: trimStr(200),
    clinicType: z.enum(CLINIC_TYPES).default('CLINIC'),
    registrationNumber: z.string().trim().max(50).optional(),
    registrationAuthority: z.string().trim().max(150).optional(),
    contactNumber: z.string().trim().regex(E164_REGEX, 'Contact number must be in E.164 format').optional(),
    address: z
      .object({
        street: trimStr(200),
        city: trimStr(100),
        district: z.string().trim().max(100).optional(),
        state: trimStr(100),
        country: trimStr(100).default('India'),
        pincode: z.string().trim().regex(PINCODE_REGEX, 'Invalid pincode'),
      })
      .strict(),
  })
  .strict();
