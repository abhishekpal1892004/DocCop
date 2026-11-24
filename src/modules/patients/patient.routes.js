import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { ROLES } from '../users/user.constants.js';
import { createProfile, getMyProfile, updateMyProfile } from './patient.controller.js';
import { createPatientProfileSchema, updatePatientProfileSchema } from './patient.validation.js';

const router = Router();

// Auth first, then role (read from MongoDB), then validation.
router.use(requireAuth, requireRole(ROLES.PATIENT));

router.post('/profile', validate({ body: createPatientProfileSchema }), createProfile);
router.get('/me', getMyProfile);
router.patch('/me', validate({ body: updatePatientProfileSchema }), updateMyProfile);

export default router;
