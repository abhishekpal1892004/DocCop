import { z } from 'zod';
import { gstinSchema } from '../../utils/gstin.js';
import { AUDIT_ACTIONS, AUDIT_TARGET_TYPES } from '../auditLogs/auditLog.constants.js';
import { APPLICATION_STATUS, NMC_VERIFICATION_STATUS } from '../doctorApplications/doctorApplication.constants.js';
import {
  CLINIC_VERIFICATION_TRACK_STATUS,
  GST_VERIFICATION_TRACK_STATUS,
  PROFESSIONAL_VERIFICATION_STATUS,
  VERIFICATION_METHODS,
} from '../doctorVerification/verification.constants.js';

const trimStr = (max) => z.string().trim().min(1).max(max);

export const adminListApplicationsQuerySchema = z
  .object({
    status: z.enum(Object.values(APPLICATION_STATUS)).optional(),
    state: trimStr(5).optional(),
    nmcVerificationStatus: z.enum(Object.values(NMC_VERIFICATION_STATUS)).optional(),
    q: trimStr(100).optional(),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export const adminIdParamSchema = z.object({ id: trimStr(64) }).strict();

export const professionalVerificationBodySchema = z
  .object({
    status: z.enum(Object.values(PROFESSIONAL_VERIFICATION_STATUS)),
    verificationMethod: z.enum(VERIFICATION_METHODS),
    officialSource: trimStr(200),
    registrationNumberChecked: trimStr(50).optional(),
    remarks: z.string().trim().max(1000).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (
      (data.status === PROFESSIONAL_VERIFICATION_STATUS.NEEDS_CORRECTION ||
        data.status === PROFESSIONAL_VERIFICATION_STATUS.REJECTED ||
        data.status === PROFESSIONAL_VERIFICATION_STATUS.UNABLE_TO_VERIFY) &&
      !data.remarks?.trim()
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['remarks'],
        message: 'Remarks are required for this verification status',
      });
    }
  });

export const clinicVerificationBodySchema = z
  .object({
    status: z.enum(Object.values(CLINIC_VERIFICATION_TRACK_STATUS)),
    registrationNumberChecked: trimStr(50).optional(),
    remarks: z.string().trim().max(1000).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (
      (data.status === CLINIC_VERIFICATION_TRACK_STATUS.NOT_APPLICABLE ||
        data.status === CLINIC_VERIFICATION_TRACK_STATUS.NEEDS_CORRECTION ||
        data.status === CLINIC_VERIFICATION_TRACK_STATUS.REJECTED) &&
      !data.remarks?.trim()
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['remarks'],
        message: 'Remarks are required when marking clinic verification as NOT_APPLICABLE, NEEDS_CORRECTION, or REJECTED',
      });
    }
  });

export const gstVerificationBodySchema = z
  .object({
    status: z.enum(Object.values(GST_VERIFICATION_TRACK_STATUS)),
    gstin: gstinSchema.optional(),
    legalBusinessName: z.string().trim().max(200).optional(),
    tradeName: z.string().trim().max(200).optional(),
    state: z.string().trim().max(100).optional(),
    principalPlaceOfBusiness: z.string().trim().max(300).optional(),
    registrationStatus: z.string().trim().max(100).optional(),
    registrationEffectiveDate: z.coerce.date().optional(),
    verificationSource: z.string().trim().max(200).optional(),
    remarks: z.string().trim().max(1000).optional(),
  })
  .strict();

export const requestInformationBodySchema = z
  .object({
    remarks: trimStr(1000),
    fieldsToCorrect: z.array(trimStr(100)).max(20).optional(),
  })
  .strict();

export const approveApplicationBodySchema = z
  .object({
    remarks: z.string().trim().max(1000).optional(),
  })
  .strict()
  .optional()
  .default({});

export const rejectApplicationBodySchema = z
  .object({
    reason: trimStr(500),
    remarks: z.string().trim().max(1000).optional(),
  })
  .strict();

export const adminListDoctorsQuerySchema = z
  .object({
    profileStatus: z.enum(['DRAFT', 'PUBLISHED', 'SUSPENDED']).optional(),
    q: trimStr(100).optional(),
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export const updateDoctorStatusBodySchema = z
  .object({
    profileStatus: z.enum(['PUBLISHED', 'SUSPENDED']),
    reason: trimStr(500),
  })
  .strict();

export const listAuditLogsQuerySchema = z
  .object({
    targetType: z.enum(Object.values(AUDIT_TARGET_TYPES)).optional(),
    targetId: trimStr(64).optional(),
    action: z.enum(Object.values(AUDIT_ACTIONS)).optional(),
    actorUserId: trimStr(64).optional(),
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
