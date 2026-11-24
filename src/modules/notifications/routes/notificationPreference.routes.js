import { Router } from 'express';
import { validate } from '../../../middleware/validate.middleware.js';
import { getPreferences, patchPreferences } from '../controllers/notificationPreference.controller.js';
import { updatePreferencesBodySchema } from '../validation/notification.validation.js';

const router = Router();

router.get('/', getPreferences);
router.patch('/', validate({ body: updatePreferencesBodySchema }), patchPreferences);

export default router;
