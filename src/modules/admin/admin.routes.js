import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import {
  adminAssociateDoctorSchema,
  adminVerifyAssociationSchema,
  adminVerifyClinicSchema,
  associationIdParamSchema,
  clinicIdParamSchema,
  listClinicsQuerySchema,
} from '../clinics/clinic.validation.js';
import { ROLES } from '../users/user.constants.js';
import analyticsRoutes from '../analytics/analytics.routes.js';
import { getAdminReviews, patchModerateReview } from '../reviews/review.controller.js';
import {
  listReviewsQuerySchema,
  moderateReviewBodySchema,
  reviewIdParamSchema,
} from '../reviews/review.validation.js';
import { getAdminTickets, patchAdminTicket } from '../support/support.controller.js';
import { getAdminSystemHealth } from './systemHealth.controller.js';
import {
  adminListTicketsQuerySchema,
  adminUpdateTicketBodySchema,
  ticketIdParamSchema,
} from '../support/support.validation.js';
import {
  getApplicationDetails,
  getAuditLogs,
  getClinicDetails,
  getDashboard,
  listApplications,
  listClinics,
  listDoctors,
  patchClinicVerification,
  patchDoctorStatus,
  patchGstVerification,
  patchProfessionalVerification,
  patchStartReview,
  patchVerifyAssociation,
  patchVerifyClinic,
  postApproveApplication,
  postAssociateDoctorToClinic,
  postRejectApplication,
  postRequestInformation,
} from './admin.controller.js';
import {
  adminIdParamSchema,
  adminListApplicationsQuerySchema,
  adminListDoctorsQuerySchema,
  approveApplicationBodySchema,
  clinicVerificationBodySchema,
  gstVerificationBodySchema,
  listAuditLogsQuerySchema,
  professionalVerificationBodySchema,
  rejectApplicationBodySchema,
  requestInformationBodySchema,
  updateDoctorStatusBodySchema,
} from './admin.validation.js';

const router = Router();

router.use(requireAuth, requireRole(ROLES.ADMIN));

router.get('/dashboard', getDashboard);
router.use('/analytics', analyticsRoutes);

// Doctor application review workflow
router.get('/doctor-applications', validate({ query: adminListApplicationsQuerySchema }), listApplications);
router.get('/doctor-applications/:id', validate({ params: adminIdParamSchema }), getApplicationDetails);
router.patch('/doctor-applications/:id/review', validate({ params: adminIdParamSchema }), patchStartReview);
router.patch(
  '/doctor-applications/:id/professional-verification',
  validate({ params: adminIdParamSchema, body: professionalVerificationBodySchema }),
  patchProfessionalVerification
);
router.patch(
  '/doctor-applications/:id/clinic-verification',
  validate({ params: adminIdParamSchema, body: clinicVerificationBodySchema }),
  patchClinicVerification
);
router.patch(
  '/doctor-applications/:id/gst-verification',
  validate({ params: adminIdParamSchema, body: gstVerificationBodySchema }),
  patchGstVerification
);
router.post(
  '/doctor-applications/:id/request-information',
  validate({ params: adminIdParamSchema, body: requestInformationBodySchema }),
  postRequestInformation
);
router.post(
  '/doctor-applications/:id/approve',
  validate({ params: adminIdParamSchema, body: approveApplicationBodySchema }),
  postApproveApplication
);
router.post(
  '/doctor-applications/:id/reject',
  validate({ params: adminIdParamSchema, body: rejectApplicationBodySchema }),
  postRejectApplication
);

// Doctor profile management (suspend / reactivate)
router.get('/doctors', validate({ query: adminListDoctorsQuerySchema }), listDoctors);
router.patch(
  '/doctors/:id/status',
  validate({ params: adminIdParamSchema, body: updateDoctorStatusBodySchema }),
  patchDoctorStatus
);

// Clinic management & doctor-clinic associations
router.get('/clinics', validate({ query: listClinicsQuerySchema }), listClinics);
router.get('/clinics/:id', validate({ params: clinicIdParamSchema }), getClinicDetails);
router.patch(
  '/clinics/:id/verify',
  validate({ params: clinicIdParamSchema, body: adminVerifyClinicSchema }),
  patchVerifyClinic
);
router.post(
  '/clinics/:id/doctors',
  validate({ params: clinicIdParamSchema, body: adminAssociateDoctorSchema }),
  postAssociateDoctorToClinic
);
router.patch(
  '/clinics/associations/:associationId/verify',
  validate({ params: associationIdParamSchema, body: adminVerifyAssociationSchema }),
  patchVerifyAssociation
);

// Append-only audit logs
router.get('/audit-logs', validate({ query: listAuditLogsQuerySchema }), getAuditLogs);

// Review moderation
router.get('/reviews', validate({ query: listReviewsQuerySchema }), getAdminReviews);
router.patch(
  '/reviews/:id/moderate',
  validate({ params: reviewIdParamSchema, body: moderateReviewBodySchema }),
  patchModerateReview
);

// Support ticket management
router.get('/support/tickets', validate({ query: adminListTicketsQuerySchema }), getAdminTickets);
router.patch(
  '/support/tickets/:id',
  validate({ params: ticketIdParamSchema, body: adminUpdateTicketBodySchema }),
  patchAdminTicket
);

// Operational system health overview
router.get('/system-health', getAdminSystemHealth);

export default router;
