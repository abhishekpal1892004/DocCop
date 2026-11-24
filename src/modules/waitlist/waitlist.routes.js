import { Router } from 'express';
import { requireActiveAccount, requireAuth, requireRole } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { ROLES } from '../users/user.constants.js';
import {
  deleteWaitlistEntry,
  getMyWaitlist,
  getOffer,
  postAcceptOffer,
  postDeclineOffer,
  postJoinWaitlist,
} from './waitlist.controller.js';
import { joinWaitlistBodySchema, waitlistIdParamSchema } from './waitlist.validation.js';

const router = Router();

router.use(requireAuth, requireActiveAccount, requireRole(ROLES.PATIENT));

router.post('/', validate({ body: joinWaitlistBodySchema }), postJoinWaitlist);
router.get('/my', getMyWaitlist);
router.delete('/:id', validate({ params: waitlistIdParamSchema }), deleteWaitlistEntry);
router.get('/offers/:id', validate({ params: waitlistIdParamSchema }), getOffer);
router.post('/offers/:id/accept', validate({ params: waitlistIdParamSchema }), postAcceptOffer);
router.post('/offers/:id/decline', validate({ params: waitlistIdParamSchema }), postDeclineOffer);

export default router;
