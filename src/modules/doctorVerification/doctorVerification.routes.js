import { Router } from 'express';
import { env } from '../../config/env.js';
import { requireAuth, requireRole } from '../../middleware/auth.middleware.js';
import { createRateLimiter } from '../../middleware/rateLimiter.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { ROLES } from '../users/user.constants.js';
import { nmcCheck, nmcStates } from './doctorVerification.controller.js';
import { nmcCheckBodySchema } from './doctorVerification.validation.js';

const router = Router();

// Per-doctor limit protecting the external NMC endpoint (in-memory; swap the store to scale out).
const nmcLimiter = createRateLimiter({
  windowMs: env.NMC_RATE_LIMIT_WINDOW_MS,
  limit: env.NMC_RATE_LIMIT_MAX,
  keyGenerator: (req) => req.identity?.clerkUserId ?? 'anonymous',
  validate: { keyGeneratorIpFallback: false },
});

router.use(requireAuth, requireRole(ROLES.DOCTOR));

router.get('/nmc-states', nmcStates);
router.post('/nmc-check', nmcLimiter, validate({ body: nmcCheckBodySchema }), nmcCheck);

export default router;
