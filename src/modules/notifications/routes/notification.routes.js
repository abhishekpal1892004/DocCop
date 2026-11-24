import { Router } from 'express';
import { requireActiveAccount, requireAuth } from '../../../middleware/auth.middleware.js';
import { validate } from '../../../middleware/validate.middleware.js';
import {
  getMyNotifications,
  patchMarkAllAsRead,
  patchMarkAsRead,
} from '../controllers/notification.controller.js';
import {
  listMyNotificationsQuerySchema,
  notificationIdParamSchema,
} from '../validation/notification.validation.js';
import preferenceRoutes from './notificationPreference.routes.js';

const router = Router();

router.use(requireAuth, requireActiveAccount);

router.use('/preferences', preferenceRoutes);

router.get('/my', validate({ query: listMyNotificationsQuerySchema }), getMyNotifications);
router.patch('/read-all', patchMarkAllAsRead);
router.patch('/:id/read', validate({ params: notificationIdParamSchema }), patchMarkAsRead);

export default router;
