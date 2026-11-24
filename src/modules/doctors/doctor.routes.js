import { Router } from 'express';
import { env } from '../../config/env.js';
import { requireAuth, requireRole } from '../../middleware/auth.middleware.js';
import { createRateLimiter } from '../../middleware/rateLimiter.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import {
  createMyAppointmentType,
  getMyAppointmentTypes,
  patchMyAppointmentType,
  patchMyAppointmentTypeStatus,
} from '../calendly/calendly.controller.js';
import {
  appointmentTypeIdParamSchema,
  availabilityQuerySchema,
  createAppointmentTypeBodySchema,
  updateAppointmentTypeBodySchema,
  updateAppointmentTypeStatusSchema,
} from '../calendly/calendly.validation.js';
import { ROLES } from '../users/user.constants.js';
import { getPublicDoctorReviews, postDoctorReview } from '../reviews/review.controller.js';
import { createReviewBodySchema, listReviewsQuerySchema } from '../reviews/review.validation.js';
import {
  getAvailability,
  getDoctorById,
  getMe,
  getMyClinics,
  getMyStatus,
  listDoctors,
  updateMe,
} from './doctor.controller.js';
import {
  doctorIdParamSchema,
  searchDoctorsQuerySchema,
  updateDoctorPracticeSchema,
} from './doctor.validation.js';

const router = Router();

const availabilityLimiter = createRateLimiter({
  windowMs: env.CALENDLY_AVAILABILITY_RATE_LIMIT_WINDOW_MS,
  limit: env.CALENDLY_AVAILABILITY_RATE_LIMIT_MAX,
});

// Public verified doctor directory.
router.get('/', validate({ query: searchDoctorsQuerySchema }), listDoctors);

// Authenticated approved doctor's own management routes (must precede /:id).
router.get('/me', requireAuth, requireRole(ROLES.DOCTOR), getMe);
router.patch('/me', requireAuth, requireRole(ROLES.DOCTOR), validate({ body: updateDoctorPracticeSchema }), updateMe);
router.get('/me/profile', requireAuth, requireRole(ROLES.DOCTOR), getMe);
router.patch('/me/profile', requireAuth, requireRole(ROLES.DOCTOR), validate({ body: updateDoctorPracticeSchema }), updateMe);
router.get('/me/clinics', requireAuth, requireRole(ROLES.DOCTOR), getMyClinics);
router.get('/me/status', requireAuth, requireRole(ROLES.DOCTOR), getMyStatus);

// Doctor appointment type management
router.get('/me/appointment-types', requireAuth, requireRole(ROLES.DOCTOR), getMyAppointmentTypes);
router.post(
  '/me/appointment-types',
  requireAuth,
  requireRole(ROLES.DOCTOR),
  validate({ body: createAppointmentTypeBodySchema }),
  createMyAppointmentType
);
router.patch(
  '/me/appointment-types/:id',
  requireAuth,
  requireRole(ROLES.DOCTOR),
  validate({ params: appointmentTypeIdParamSchema, body: updateAppointmentTypeBodySchema }),
  patchMyAppointmentType
);
router.patch(
  '/me/appointment-types/:id/status',
  requireAuth,
  requireRole(ROLES.DOCTOR),
  validate({ params: appointmentTypeIdParamSchema, body: updateAppointmentTypeStatusSchema }),
  patchMyAppointmentTypeStatus
);

router.get(
  '/:id/availability',
  availabilityLimiter,
  validate({ params: doctorIdParamSchema, query: availabilityQuerySchema }),
  getAvailability
);
router.get('/:id/reviews', validate({ params: doctorIdParamSchema, query: listReviewsQuerySchema }), getPublicDoctorReviews);
router.post(
  '/:id/reviews',
  requireAuth,
  requireRole(ROLES.PATIENT),
  validate({ params: doctorIdParamSchema, body: createReviewBodySchema }),
  postDoctorReview
);
router.get('/:id', validate({ params: doctorIdParamSchema }), getDoctorById);

export default router;
