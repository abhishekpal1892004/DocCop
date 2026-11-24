import { Router } from 'express';
import { requireActiveAccount, requireAuth, requireRole } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { ROLES } from '../users/user.constants.js';
import {
  getMyPayments,
  getPayment,
  postCreateOrder,
  postRefundPayment,
  postVerifyPayment,
} from './payment.controller.js';
import {
  createOrderBodySchema,
  listPaymentsQuerySchema,
  paymentIdParamSchema,
  refundPaymentBodySchema,
  verifyPaymentBodySchema,
} from './payment.validation.js';

const router = Router();

router.use(requireAuth, requireActiveAccount);

router.post('/create-order', requireRole(ROLES.PATIENT), validate({ body: createOrderBodySchema }), postCreateOrder);
router.post('/verify', requireRole(ROLES.PATIENT), validate({ body: verifyPaymentBodySchema }), postVerifyPayment);
router.get('/my', requireRole(ROLES.PATIENT), validate({ query: listPaymentsQuerySchema }), getMyPayments);
router.get('/:id', requireRole(ROLES.PATIENT, ROLES.ADMIN), validate({ params: paymentIdParamSchema }), getPayment);
router.post(
  '/:id/refund',
  requireRole(ROLES.PATIENT, ROLES.ADMIN),
  validate({ params: paymentIdParamSchema, body: refundPaymentBodySchema }),
  postRefundPayment
);

export default router;
