import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { ROLES } from '../users/user.constants.js';
import {
  calendlyCallback,
  connectCalendly,
  disconnect,
  getEventTypes,
  getStatus,
  selectEventType,
  syncEventTypes,
} from './calendly.controller.js';
import { oauthCallbackQuerySchema, selectEventTypeBodySchema } from './calendly.validation.js';

const router = Router();

// OAuth redirect callback from Calendly (CSRF protected via backend OAuth state + PKCE).
router.get('/callback', validate({ query: oauthCallbackQuerySchema }), calendlyCallback);

// Authenticated approved-doctor endpoints.
router.use(requireAuth, requireRole(ROLES.DOCTOR));

router.get('/connect', connectCalendly);
router.get('/status', getStatus);
router.get('/event-types', getEventTypes);
router.post('/event-types/sync', syncEventTypes);
router.post('/event-types/select', validate({ body: selectEventTypeBodySchema }), selectEventType);
router.delete('/disconnect', disconnect);

export default router;
