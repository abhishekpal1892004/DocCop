import { Router } from 'express';
import { requireActiveAccount, requireAuth } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import {
  deleteClinicStaffMember,
  getClinicStaff,
  patchStaffPermissions,
  postAcceptInvitation,
  postInviteStaff,
} from './staff.controller.js';
import {
  acceptInvitationBodySchema,
  clinicStaffParamSchema,
  inviteStaffBodySchema,
  removeStaffParamsSchema,
  staffIdParamSchema,
  updateStaffPermissionsBodySchema,
} from './staff.validation.js';

export const clinicStaffRoutes = Router({ mergeParams: true });
clinicStaffRoutes.use(requireAuth, requireActiveAccount);
clinicStaffRoutes.post('/invite', validate({ params: clinicStaffParamSchema, body: inviteStaffBodySchema }), postInviteStaff);
clinicStaffRoutes.get('/', validate({ params: clinicStaffParamSchema }), getClinicStaff);
clinicStaffRoutes.delete('/:userId', validate({ params: removeStaffParamsSchema }), deleteClinicStaffMember);

export const staffRoutes = Router();
staffRoutes.use(requireAuth);
staffRoutes.post('/invitations/accept', validate({ body: acceptInvitationBodySchema }), postAcceptInvitation);
staffRoutes.patch(
  '/:id/permissions',
  requireActiveAccount,
  validate({ params: staffIdParamSchema, body: updateStaffPermissionsBodySchema }),
  patchStaffPermissions
);
