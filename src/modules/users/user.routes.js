import { Router } from 'express';
import { requireAuth, requireActiveAccount } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { onboard, getMe, updateMe } from './user.controller.js';
import { onboardBodySchema, updateMeBodySchema } from './user.validation.js';

const router = Router();

router.post('/onboard', requireAuth, validate({ body: onboardBodySchema }), onboard);
// /me stays readable for suspended users so clients can show an appropriate message.
router.get('/me', requireAuth, getMe);
router.patch('/me', requireAuth, requireActiveAccount, validate({ body: updateMeBodySchema }), updateMe);

export default router;
