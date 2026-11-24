import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { ROLES } from '../users/user.constants.js';
import { getReviewApplication, listReviewQueue, postReviewDecision } from './adminDoctorApplication.controller.js';
import {
  applicationIdParamSchema,
  listReviewApplicationsQuerySchema,
  reviewApplicationBodySchema,
} from './doctorApplication.validation.js';

const router = Router();

router.use(requireAuth, requireRole(ROLES.ADMIN));

router.get('/', validate({ query: listReviewApplicationsQuerySchema }), listReviewQueue);
router.get('/:id', validate({ params: applicationIdParamSchema }), getReviewApplication);
router.post(
  '/:id/review',
  validate({ params: applicationIdParamSchema, body: reviewApplicationBodySchema }),
  postReviewDecision
);

export default router;
