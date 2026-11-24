import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { ROLES } from '../users/user.constants.js';
import {
  createApplication,
  getApplicationStatus,
  getMyApplication,
  submitApplication,
  updateMyApplication,
} from './doctorApplication.controller.js';
import { createApplicationSchema, updateApplicationSchema } from './doctorApplication.validation.js';

const router = Router();

router.use(requireAuth, requireRole(ROLES.DOCTOR));

router.post('/', validate({ body: createApplicationSchema }), createApplication);
router.get('/me', getMyApplication);
router.patch('/me', validate({ body: updateApplicationSchema }), updateMyApplication);
router.post('/submit', submitApplication);
router.get('/status', getApplicationStatus);

export default router;
