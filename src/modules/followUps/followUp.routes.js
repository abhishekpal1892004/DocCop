import { Router } from 'express';
import { requireActiveAccount, requireAuth, requireRole } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { ROLES } from '../users/user.constants.js';
import {
  getMyFollowUps,
  patchFollowUpStatus,
  postBookFollowUp,
  postCreateFollowUp,
} from './followUp.controller.js';
import {
  bookFollowUpBodySchema,
  createFollowUpBodySchema,
  followUpIdParamSchema,
  updateFollowUpStatusBodySchema,
} from './followUp.validation.js';

const router = Router();

router.use(requireAuth, requireActiveAccount);

router.post('/', requireRole(ROLES.DOCTOR), validate({ body: createFollowUpBodySchema }), postCreateFollowUp);
router.get('/my', requireRole(ROLES.PATIENT), getMyFollowUps);
router.patch(
  '/:id/status',
  requireRole(ROLES.PATIENT, ROLES.DOCTOR),
  validate({ params: followUpIdParamSchema, body: updateFollowUpStatusBodySchema }),
  patchFollowUpStatus
);
router.post(
  '/:id/book',
  requireRole(ROLES.PATIENT),
  validate({ params: followUpIdParamSchema, body: bookFollowUpBodySchema }),
  postBookFollowUp
);

export default router;
