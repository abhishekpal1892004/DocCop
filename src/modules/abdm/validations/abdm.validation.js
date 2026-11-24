import { z } from 'zod';

const trimStr = (max) => z.string().trim().min(1).max(max);

export const idParamSchema = z.object({ id: trimStr(64) }).strict();

export const initiateAbhaBodySchema = z
  .object({
    abhaNumber: z.string().trim().regex(/^\d{2}-?\d{4}-?\d{4}-?\d{4}$/, 'Invalid ABHA number format').optional(),
    abhaAddress: z.string().trim().min(4).max(100).regex(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$/, 'Invalid ABHA address').optional(),
  })
  .strict()
  .refine((v) => Boolean(v.abhaNumber || v.abhaAddress), {
    message: 'Provide either abhaNumber or abhaAddress',
  });

export const verifyAbhaBodySchema = z
  .object({
    txnId: trimStr(120),
    otp: z.string().trim().min(4).max(10),
  })
  .strict();

export const hprSearchBodySchema = z.object({ hprId: trimStr(64) }).strict();
export const hprLinkBodySchema = z.object({ hprId: trimStr(64) }).strict();

export const hfrSearchBodySchema = z
  .object({
    clinicId: trimStr(64),
    hfrId: trimStr(64),
  })
  .strict();

export const hfrLinkBodySchema = z
  .object({
    clinicId: trimStr(64),
    hfrId: trimStr(64),
  })
  .strict();

export const hfrStatusQuerySchema = z.object({ clinicId: trimStr(64) }).strict();

export const hipLinkRecordBodySchema = z
  .object({
    recordSourceType: z.enum(['PRESCRIPTION', 'CONSULTATION', 'MEDICAL_RECORD']),
    healthRecordId: trimStr(64),
  })
  .strict();

export const hipNotifyRecordBodySchema = z
  .object({
    exchangeId: trimStr(64),
  })
  .strict();

export const hiuDiscoverBodySchema = z
  .object({
    hipId: trimStr(64),
  })
  .strict();

export const hiuConsentRequestBodySchema = z
  .object({
    patientId: trimStr(64).optional(),
    purpose: trimStr(200),
    recordTypes: z.array(trimStr(64)).min(1).max(10),
    dateRange: z
      .object({
        from: z.coerce.date(),
        to: z.coerce.date(),
      })
      .strict(),
    expiresAt: z.coerce.date(),
  })
  .strict()
  .refine((v) => v.dateRange.to >= v.dateRange.from, { message: 'dateRange.to must be >= dateRange.from' });

export const hiuDataRequestBodySchema = z
  .object({
    consentId: trimStr(64),
  })
  .strict();

export const reviewRegistryBodySchema = z
  .object({
    adminReviewStatus: z.enum(['APPROVED', 'REJECTED']),
  })
  .strict();
