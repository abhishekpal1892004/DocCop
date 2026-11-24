import { z } from 'zod';
import { STAFF_PERMISSIONS, STAFF_ROLES } from './staffInvitation.model.js';

const trimStr = (max) => z.string().trim().min(1).max(max);

export const clinicStaffParamSchema = z.object({ id: trimStr(64) }).strict();
export const removeStaffParamsSchema = z.object({ id: trimStr(64), userId: trimStr(64) }).strict();
export const staffIdParamSchema = z.object({ id: trimStr(64) }).strict();

export const inviteStaffBodySchema = z
  .object({
    email: z.string().trim().email().max(254),
    role: z.enum(STAFF_ROLES),
    permissions: z.array(z.enum(STAFF_PERMISSIONS)).optional(),
    expiresInHours: z.number().int().min(1).max(168).default(48),
  })
  .strict();

export const acceptInvitationBodySchema = z
  .object({
    token: trimStr(256),
  })
  .strict();

export const updateStaffPermissionsBodySchema = z
  .object({
    permissions: z.array(z.enum(STAFF_PERMISSIONS)).min(1),
  })
  .strict();
