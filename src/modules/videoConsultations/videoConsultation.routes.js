import { Router } from 'express';
import { requireActiveAccount, requireAuth, requireRole } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { ROLES } from '../users/user.constants.js';
import { postCompleteConsultation, postConsultationToken } from './videoConsultation.controller.js';
import {
  generateVideoTokenBodySchema,
  videoAppointmentIdParamSchema,
} from './videoConsultation.validation.js';

const router = Router();

router.use(requireAuth, requireActiveAccount);

router.post(
  '/:appointmentId/token',
  requireRole(ROLES.PATIENT, ROLES.DOCTOR),
  validate({ params: videoAppointmentIdParamSchema, body: generateVideoTokenBodySchema }),
  postConsultationToken
);
router.post(
  '/:appointmentId/complete',
  requireRole(ROLES.DOCTOR),
  validate({ params: videoAppointmentIdParamSchema }),
  postCompleteConsultation
);

export default router;
