import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { ROLES } from '../users/user.constants.js';
import {
  getAppointmentById,
  getMyAppointments,
  postBookAppointment,
  postCancelAppointment,
  postRescheduleAppointment,
} from './appointment.controller.js';
import {
  appointmentIdParamSchema,
  bookAppointmentBodySchema,
  cancelAppointmentBodySchema,
  listAppointmentsQuerySchema,
} from './appointment.validation.js';

const router = Router();

router.use(requireAuth);

router.get('/my', requireRole(ROLES.PATIENT), validate({ query: listAppointmentsQuerySchema }), getMyAppointments);
router.post('/', requireRole(ROLES.PATIENT), validate({ body: bookAppointmentBodySchema }), postBookAppointment);
router.get('/:id', requireRole(ROLES.PATIENT, ROLES.DOCTOR), validate({ params: appointmentIdParamSchema }), getAppointmentById);
router.post(
  '/:id/cancel',
  requireRole(ROLES.PATIENT, ROLES.DOCTOR),
  validate({ params: appointmentIdParamSchema, body: cancelAppointmentBodySchema }),
  postCancelAppointment
);
router.post(
  '/:id/reschedule',
  requireRole(ROLES.PATIENT),
  validate({ params: appointmentIdParamSchema }),
  postRescheduleAppointment
);

export default router;
