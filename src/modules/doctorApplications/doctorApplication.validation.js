import { z } from 'zod';
import { gstinSchema } from '../../utils/gstin.js';
import { E164_REGEX } from '../patients/patient.constants.js';
import {
  APPLICATION_STATUS,
  CLINIC_RELATIONSHIPS,
  CLINIC_TYPES,
  MEDICAL_SYSTEMS,
  NMC_VERIFICATION_STATUS,
  PINCODE_REGEX,
  REVIEW_ACTIONS,
} from './doctorApplication.constants.js';

const text = (max) => z.string().trim().min(1, 'Must not be empty').max(max);
const phone = z.string().trim().regex(E164_REGEX, 'Phone number must be in E.164 format, e.g. +919876543210');
const currentYear = () => new Date().getFullYear();

export const registrationNumberSchema = z
  .string()
  .trim()
  .min(1)
  .max(30)
  .regex(/^[A-Za-z0-9][A-Za-z0-9/\- ]*$/, 'Registration number may contain only letters, digits, space, "/" and "-"');
export const stateCodeSchema = z.string().trim().toUpperCase().regex(/^[A-Z]{2,5}$/, 'State code must be 2-5 letters');
export const registrationYearSchema = z.coerce.number().int().min(1900).refine((y) => y <= currentYear(), 'Registration year cannot be in the future');

const address = z
  .object({
    street: text(200).optional(),
    city: text(100).optional(),
    state: text(100).optional(),
    country: text(100).optional(),
    pincode: z.string().trim().regex(PINCODE_REGEX, 'Pincode must be a 6-digit Indian pincode').optional(),
  })
  .strict();

// ---- Draft (partial) section schemas. All strict: unknown/protected fields are rejected. ----
const sections = {
  // email and profileImage come from the verified identity and cannot be edited here.
  personalDetails: z.object({ fullName: text(120).optional(), phoneNumber: phone.optional() }).strict(),
  professionalDetails: z
    .object({
      qualification: text(200).optional(),
      specialization: text(100).optional(),
      experience: z.coerce.number().int().min(0).max(70).optional(),
      medicalSystem: z.enum(MEDICAL_SYSTEMS).optional(),
      collegeName: text(200).optional(),
    })
    .strict(),
  medicalRegistration: z
    .object({
      councilName: text(150).optional(),
      registrationNumber: registrationNumberSchema.optional(),
      registrationYear: registrationYearSchema.optional(),
      stateCode: stateCodeSchema.optional(),
    })
    .strict(),
  clinicDetails: z
    .object({
      clinicName: text(200).optional(),
      clinicType: z.enum(CLINIC_TYPES).optional(),
      relationship: z.enum(CLINIC_RELATIONSHIPS).optional(),
      clinicRegistrationNumber: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9/\- ]{1,49}$/, 'Invalid registration number').optional(),
      registrationAuthority: text(150).optional(),
      address: address.optional(),
    })
    .strict(),
  gstDetails: z
    .object({
      isGSTRegistered: z.boolean().optional(),
      gstin: gstinSchema.optional(),
      legalBusinessName: text(200).optional(),
    })
    .strict()
    .refine((g) => !(g.isGSTRegistered === false && g.gstin), { message: 'GSTIN cannot be provided when isGSTRegistered is false', path: ['gstin'] }),
};

const sectionsObject = Object.fromEntries(Object.entries(sections).map(([k, v]) => [k, v.optional()]));

export const createApplicationSchema = z.object(sectionsObject).strict();

export const updateApplicationSchema = z
  .object(sectionsObject)
  .strict()
  .refine((b) => Object.values(b).some((v) => v && Object.keys(v).length > 0), { message: 'At least one field must be provided' });

// ---- Completeness checks applied to the stored application at submission. ----
export const submitSchema = z
  .object({
    personalDetails: z.object({ fullName: text(120), phoneNumber: phone, email: z.string().min(1) }),
    professionalDetails: z.object({
      qualification: text(200),
      specialization: text(100),
      experience: z.number().int().min(0).max(70),
      medicalSystem: z.enum(MEDICAL_SYSTEMS),
      collegeName: text(200),
    }),
    medicalRegistration: z.object({
      councilName: text(150),
      registrationNumber: registrationNumberSchema,
      registrationYear: registrationYearSchema,
      stateCode: stateCodeSchema,
    }),
    clinicDetails: z.object({
      clinicName: text(200),
      clinicType: z.enum(CLINIC_TYPES),
      relationship: z.enum(CLINIC_RELATIONSHIPS),
      clinicRegistrationNumber: z.string().optional(),
      registrationAuthority: z.string().optional(),
      address: z.object({
        street: text(200),
        city: text(100),
        state: text(100),
        country: text(100),
        pincode: z.string().regex(PINCODE_REGEX, 'Pincode must be a 6-digit Indian pincode'),
      }),
    }),
    gstDetails: z
      .object({
        isGSTRegistered: z.boolean({ message: 'State whether the business is GST registered' }),
        gstin: z.string().optional(),
        legalBusinessName: z.string().optional(),
      })
      .superRefine((g, ctx) => {
        if (g.isGSTRegistered) {
          const parsed = gstinSchema.safeParse(g.gstin ?? '');
          if (!parsed.success) ctx.addIssue({ code: 'custom', path: ['gstin'], message: 'A valid GSTIN is required when GST registered' });
          if (!g.legalBusinessName?.trim()) ctx.addIssue({ code: 'custom', path: ['legalBusinessName'], message: 'Legal business name is required when GST registered' });
        }
      }),
  })
  .passthrough();

export const applicationIdParamSchema = z
  .object({
    id: z.string().trim().min(1).max(64),
  })
  .strict();

export const listReviewApplicationsQuerySchema = z
  .object({
    status: z.enum(Object.values(APPLICATION_STATUS)).optional(),
    nmcVerificationStatus: z.enum(Object.values(NMC_VERIFICATION_STATUS)).optional(),
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export const reviewApplicationBodySchema = z
  .object({
    action: z.enum(Object.values(REVIEW_ACTIONS)),
    notes: z.string().trim().max(1000).optional(),
    reason: z.string().trim().max(500).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.action === REVIEW_ACTIONS.REQUEST_INFO && !data.notes?.trim() && !data.reason?.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['notes'],
        message: 'Details of requested changes are required when requesting more information',
      });
    }
    if (data.action === REVIEW_ACTIONS.REJECT && !data.reason?.trim() && !data.notes?.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'A rejection reason is required when rejecting an application',
      });
    }
  });
