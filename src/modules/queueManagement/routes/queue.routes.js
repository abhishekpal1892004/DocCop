import { Router } from 'express';
import { requireActiveAccount, requireAuth, requireRole } from '../../../middleware/auth.middleware.js';
import { validate } from '../../../middleware/validate.middleware.js';
import { ROLES } from '../../users/user.constants.js';
import {
  getCurrentQueue,
  getMyPosition,
  patchCallNext,
  patchCloseQueue,
  patchCompleteEntry,
  patchPauseQueue,
  patchResumeQueue,
  patchSkipEntry,
  patchStartEntry,
  postCheckIn,
  postOpenQueue,
} from '../controllers/queue.controller.js';
import {
  checkInBodySchema,
  myPositionQuerySchema,
  openQueueBodySchema,
  queueEntryParamsSchema,
  queueIdParamSchema,
} from '../validations/queue.validation.js';

export const patientQueueRoutes = Router();
patientQueueRoutes.use(requireAuth, requireActiveAccount, requireRole(ROLES.PATIENT));
patientQueueRoutes.post('/check-in', validate({ body: checkInBodySchema }), postCheckIn);
patientQueueRoutes.get('/my-position', validate({ query: myPositionQuerySchema }), getMyPosition);

export const doctorQueueRoutes = Router();
doctorQueueRoutes.use(requireAuth, requireActiveAccount, requireRole(ROLES.DOCTOR));
doctorQueueRoutes.post('/', validate({ body: openQueueBodySchema }), postOpenQueue);
doctorQueueRoutes.get('/current', getCurrentQueue);
doctorQueueRoutes.patch('/:id/call-next', validate({ params: queueIdParamSchema }), patchCallNext);
doctorQueueRoutes.patch('/:id/entries/:entryId/start', validate({ params: queueEntryParamsSchema }), patchStartEntry);
doctorQueueRoutes.patch('/:id/entries/:entryId/complete', validate({ params: queueEntryParamsSchema }), patchCompleteEntry);
doctorQueueRoutes.patch('/:id/entries/:entryId/skip', validate({ params: queueEntryParamsSchema }), patchSkipEntry);
doctorQueueRoutes.patch('/:id/pause', validate({ params: queueIdParamSchema }), patchPauseQueue);
doctorQueueRoutes.patch('/:id/resume', validate({ params: queueIdParamSchema }), patchResumeQueue);
doctorQueueRoutes.patch('/:id/close', validate({ params: queueIdParamSchema }), patchCloseQueue);
