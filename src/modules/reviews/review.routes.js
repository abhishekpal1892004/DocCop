import { Router } from 'express';
import { requireActiveAccount, requireAuth, requireRole } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { ROLES } from '../users/user.constants.js';
import {
  deleteOwnReview,
  getMyReviews,
  patchMyReview,
  postReportReview,
} from './review.controller.js';
import {
  listReviewsQuerySchema,
  reportReviewBodySchema,
  reviewIdParamSchema,
  updateReviewBodySchema,
} from './review.validation.js';

const router = Router();

router.use(requireAuth, requireActiveAccount);

router.get('/my', requireRole(ROLES.PATIENT), validate({ query: listReviewsQuerySchema }), getMyReviews);
router.patch('/:id', requireRole(ROLES.PATIENT), validate({ params: reviewIdParamSchema, body: updateReviewBodySchema }), patchMyReview);
router.delete('/:id', requireRole(ROLES.PATIENT), validate({ params: reviewIdParamSchema }), deleteOwnReview);
router.post(
  '/:id/report',
  requireRole(ROLES.PATIENT, ROLES.DOCTOR),
  validate({ params: reviewIdParamSchema, body: reportReviewBodySchema }),
  postReportReview
);

export default router;
