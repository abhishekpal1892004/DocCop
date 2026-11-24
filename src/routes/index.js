import { Router } from 'express';
import healthRoutes from '../modules/health/health.routes.js';
import userRoutes from '../modules/users/user.routes.js';
import patientRoutes from '../modules/patients/patient.routes.js';
import doctorApplicationRoutes from '../modules/doctorApplications/doctorApplication.routes.js';
import doctorVerificationRoutes from '../modules/doctorVerification/doctorVerification.routes.js';
import doctorRoutes from '../modules/doctors/doctor.routes.js';
import clinicRoutes from '../modules/clinics/clinic.routes.js';
import adminRoutes from '../modules/admin/admin.routes.js';
import calendlyRoutes from '../modules/calendly/calendly.routes.js';
import appointmentRoutes from '../modules/appointments/appointment.routes.js';
import notificationRoutes from '../modules/notifications/routes/notification.routes.js';
import medicalRecordRoutes from '../modules/medicalRecords/routes/medicalRecord.routes.js';
import prescriptionRoutes from '../modules/prescriptions/routes/prescription.routes.js';
import { getDoctorPrescriptions } from '../modules/prescriptions/controllers/prescription.controller.js';
import { listPrescriptionsQuerySchema } from '../modules/prescriptions/validations/prescription.validation.js';
import consultationRoutes from '../modules/consultations/consultation.routes.js';
import paymentRoutes from '../modules/payments/payment.routes.js';
import videoConsultationRoutes from '../modules/videoConsultations/videoConsultation.routes.js';
import reviewRoutes from '../modules/reviews/review.routes.js';
import { doctorQueueRoutes, patientQueueRoutes } from '../modules/queueManagement/routes/queue.routes.js';
import organizationRoutes from '../modules/organizations/organization.routes.js';
import { staffRoutes } from '../modules/staffManagement/staff.routes.js';
import waitlistRoutes from '../modules/waitlist/waitlist.routes.js';
import followUpRoutes from '../modules/followUps/followUp.routes.js';
import supportRoutes from '../modules/support/support.routes.js';
import abdmRoutes from '../modules/abdm/routes/abdm.routes.js';
import fhirRoutes from '../modules/interoperability/fhir/fhir.routes.js';
import { getDoctorFollowUps } from '../modules/followUps/followUp.controller.js';
import { getDoctorConsultations } from '../modules/consultations/consultation.controller.js';
import { listConsultationsQuerySchema } from '../modules/consultations/consultation.validation.js';
import { getDoctorAppointments } from '../modules/appointments/appointment.controller.js';
import { listAppointmentsQuerySchema } from '../modules/appointments/appointment.validation.js';
import { clerkAuth, requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { ROLES } from '../modules/users/user.constants.js';

const router = Router();

// Public: no Clerk dependency so health checks keep working if Clerk is unreachable.
router.use('/health', healthRoutes);

// Everything below validates the Clerk session token (routes then opt in via requireAuth).
router.use(clerkAuth);
router.use('/users', userRoutes);
router.use('/patients', patientRoutes);
router.use('/doctor-applications', doctorApplicationRoutes);
router.use('/doctor-verification', doctorVerificationRoutes);
router.use('/doctors', doctorRoutes);
router.use('/clinics', clinicRoutes);
router.use('/admin', adminRoutes);
router.use('/integrations/calendly', calendlyRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/notifications', notificationRoutes);
router.use('/medical-records', medicalRecordRoutes);
router.use('/prescriptions', prescriptionRoutes);
router.use('/consultations', consultationRoutes);
router.use('/payments', paymentRoutes);
router.use('/video-consultations', videoConsultationRoutes);
router.use('/reviews', reviewRoutes);
router.use('/queues', patientQueueRoutes);
router.use('/doctor/queues', doctorQueueRoutes);
router.use('/organizations', organizationRoutes);
router.use('/staff', staffRoutes);
router.use('/waitlist', waitlistRoutes);
router.use('/follow-ups', followUpRoutes);
router.use('/support', supportRoutes);
router.use('/abdm', abdmRoutes);
router.use('/interoperability/fhir', fhirRoutes);
router.get(
  '/doctor/appointments',
  requireAuth,
  requireRole(ROLES.DOCTOR),
  validate({ query: listAppointmentsQuerySchema }),
  getDoctorAppointments
);
router.get(
  '/doctor/prescriptions',
  requireAuth,
  requireRole(ROLES.DOCTOR),
  validate({ query: listPrescriptionsQuerySchema }),
  getDoctorPrescriptions
);
router.get(
  '/doctor/consultations',
  requireAuth,
  requireRole(ROLES.DOCTOR),
  validate({ query: listConsultationsQuerySchema }),
  getDoctorConsultations
);
router.get(
  '/doctor/follow-ups',
  requireAuth,
  requireRole(ROLES.DOCTOR),
  getDoctorFollowUps
);
// Future modules mount here.

export default router;
