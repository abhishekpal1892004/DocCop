import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { ROLES } from '../users/user.constants.js';
import {
  getAppointments,
  getClinics,
  getDoctors,
  getOverview,
  getUsers,
} from './analytics.controller.js';
import { analyticsDateRangeQuerySchema } from './analytics.validation.js';

const router = Router();

router.use(requireAuth, requireRole(ROLES.ADMIN));

router.get('/overview', getOverview);
router.get('/appointments', validate({ query: analyticsDateRangeQuerySchema }), getAppointments);
router.get('/users', validate({ query: analyticsDateRangeQuerySchema }), getUsers);
router.get('/doctors', validate({ query: analyticsDateRangeQuerySchema }), getDoctors);
router.get('/clinics', validate({ query: analyticsDateRangeQuerySchema }), getClinics);

export default router;
