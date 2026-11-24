import { z } from 'zod';
import {
  ASSOCIATION_VERIFICATION_STATUS,
  CLINIC_RELATIONSHIP_TYPES,
  CLINIC_VERIFICATION_STATUS,
} from './clinic.constants.js';

const trimStr = (max) => z.string().trim().min(1).max(max);

export const listClinicsQuerySchema = z
  .object({
    verificationStatus: z.enum(Object.values(CLINIC_VERIFICATION_STATUS)).optional(),
    city: trimStr(100).optional(),
    state: trimStr(100).optional(),
    q: trimStr(100).optional(),
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export const clinicIdParamSchema = z.object({ id: trimStr(64) }).strict();
export const associationIdParamSchema = z.object({ associationId: trimStr(64) }).strict();

export const doctorAssociateClinicSchema = z
  .object({
    clinicId: trimStr(64),
    relationshipType: z.enum(CLINIC_RELATIONSHIP_TYPES),
    affiliationDocumentId: trimStr(100).optional(),
  })
  .strict();

export const adminVerifyClinicSchema = z
  .object({
    verificationStatus: z.enum([
      CLINIC_VERIFICATION_STATUS.IN_REVIEW,
      CLINIC_VERIFICATION_STATUS.VERIFIED,
      CLINIC_VERIFICATION_STATUS.NEEDS_CORRECTION,
      CLINIC_VERIFICATION_STATUS.REJECTED,
      CLINIC_VERIFICATION_STATUS.NOT_APPLICABLE,
    ]),
    remarks: z.string().trim().max(1000).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (
      (data.verificationStatus === CLINIC_VERIFICATION_STATUS.NEEDS_CORRECTION ||
        data.verificationStatus === CLINIC_VERIFICATION_STATUS.REJECTED) &&
      !data.remarks?.trim()
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['remarks'],
        message: 'Remarks are required when requesting corrections or rejecting a clinic',
      });
    }
  });

export const adminAssociateDoctorSchema = z
  .object({
    doctorUserId: trimStr(64),
    relationshipType: z.enum(CLINIC_RELATIONSHIP_TYPES),
    affiliationDocumentId: trimStr(100).optional(),
    verificationStatus: z.enum(Object.values(ASSOCIATION_VERIFICATION_STATUS)).optional(),
    remarks: z.string().trim().max(500).optional(),
  })
  .strict();

export const adminVerifyAssociationSchema = z
  .object({
    verificationStatus: z.enum(Object.values(ASSOCIATION_VERIFICATION_STATUS)),
    remarks: z.string().trim().max(500).optional(),
  })
  .strict();
