import { Router } from 'express';
import { requireActiveAccount, requireAuth, requireRole } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { ROLES } from '../users/user.constants.js';
import {
  getConsultation,
  getMyConsultations,
  patchConsultation,
  postCompleteConsultation,
  postCreateConsultation,
} from './consultation.controller.js';
import {
  consultationIdParamSchema,
  createConsultationBodySchema,
  listConsultationsQuerySchema,
  updateConsultationBodySchema,
} from './consultation.validation.js';

const router = Router();

router.use(requireAuth, requireActiveAccount);

router.post('/', requireRole(ROLES.DOCTOR), validate({ body: createConsultationBodySchema }), postCreateConsultation);
router.get('/my', requireRole(ROLES.PATIENT), validate({ query: listConsultationsQuerySchema }), getMyConsultations);
router.get('/:id', requireRole(ROLES.PATIENT, ROLES.DOCTOR), validate({ params: consultationIdParamSchema }), getConsultation);
router.patch(
  '/:id',
  requireRole(ROLES.DOCTOR),
  validate({ params: consultationIdParamSchema, body: updateConsultationBodySchema }),
  patchConsultation
);
router.post(
  '/:id/complete',
  requireRole(ROLES.DOCTOR),
  validate({ params: consultationIdParamSchema }),
  postCompleteConsultation
);

export default router;
