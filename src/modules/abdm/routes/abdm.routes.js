import { Router } from 'express';
import { requireActiveAccount, requireAuth, requireRole } from '../../../middleware/auth.middleware.js';
import { validate } from '../../../middleware/validate.middleware.js';
import { ROLES } from '../../users/user.constants.js';
import {
  getMyHiuConsents,
  getHiuConsent,
  postHiuConsentRequest,
  postHiuConsentRevoke,
} from '../consent/consent.controller.js';
import {
  getAdminAbdmDashboard,
  getClinicHfrStatus,
  getHipRecordStatus,
  getHiuExchange,
  getMyHiuImports,
  getMyHprStatus,
  patchAdminRegistryReview,
  postHfrLink,
  postHfrSearch,
  postHipLinkRecord,
  postHipNotifyRecord,
  postHiuDataRequest,
  postHiuDiscover,
  postHprLink,
  postHprSearch,
} from '../controllers/abdm.controller.js';
import {
  deleteMyAbhaLink,
  getMyAbhaStatus,
  postInitiateAbhaLink,
  postVerifyAbhaLink,
} from '../controllers/abha.controller.js';
import {
  hfrLinkBodySchema,
  hfrSearchBodySchema,
  hfrStatusQuerySchema,
  hipLinkRecordBodySchema,
  hipNotifyRecordBodySchema,
  hiuConsentRequestBodySchema,
  hiuDataRequestBodySchema,
  hiuDiscoverBodySchema,
  hprLinkBodySchema,
  hprSearchBodySchema,
  idParamSchema,
  initiateAbhaBodySchema,
  reviewRegistryBodySchema,
  verifyAbhaBodySchema,
} from '../validations/abdm.validation.js';

const router = Router();
router.use(requireAuth, requireActiveAccount);

// ABHA (Patient optional linking)
router.post('/abha/initiate-link', requireRole(ROLES.PATIENT), validate({ body: initiateAbhaBodySchema }), postInitiateAbhaLink);
router.post('/abha/link/initiate', requireRole(ROLES.PATIENT), validate({ body: initiateAbhaBodySchema }), postInitiateAbhaLink);
router.post('/abha/verify', requireRole(ROLES.PATIENT), validate({ body: verifyAbhaBodySchema }), postVerifyAbhaLink);
router.post('/abha/link/verify', requireRole(ROLES.PATIENT), validate({ body: verifyAbhaBodySchema }), postVerifyAbhaLink);
router.get('/abha/status', requireRole(ROLES.PATIENT), getMyAbhaStatus);
router.delete('/abha/unlink', requireRole(ROLES.PATIENT), deleteMyAbhaLink);
router.delete('/abha/link', requireRole(ROLES.PATIENT), deleteMyAbhaLink);

// HPR (Doctor)
router.post('/hpr/search', requireRole(ROLES.DOCTOR), validate({ body: hprSearchBodySchema }), postHprSearch);
router.post('/hpr/link', requireRole(ROLES.DOCTOR), validate({ body: hprLinkBodySchema }), postHprLink);
router.get('/hpr/status', requireRole(ROLES.DOCTOR), getMyHprStatus);

// HFR (Clinic)
router.post(
  '/hfr/search',
  requireRole(ROLES.DOCTOR, ROLES.CLINIC_MANAGER, ROLES.ADMIN),
  validate({ body: hfrSearchBodySchema }),
  postHfrSearch
);
router.post(
  '/hfr/link',
  requireRole(ROLES.DOCTOR, ROLES.CLINIC_MANAGER, ROLES.ADMIN),
  validate({ body: hfrLinkBodySchema }),
  postHfrLink
);
router.get(
  '/hfr/status',
  requireRole(ROLES.DOCTOR, ROLES.CLINIC_MANAGER, ROLES.RECEPTIONIST, ROLES.ADMIN),
  validate({ query: hfrStatusQuerySchema }),
  getClinicHfrStatus
);

// HIP
router.post(
  '/hip/records/link',
  requireRole(ROLES.PATIENT, ROLES.DOCTOR, ROLES.ADMIN),
  validate({ body: hipLinkRecordBodySchema }),
  postHipLinkRecord
);
router.post(
  '/hip/records/notify',
  requireRole(ROLES.PATIENT, ROLES.DOCTOR, ROLES.ADMIN),
  validate({ body: hipNotifyRecordBodySchema }),
  postHipNotifyRecord
);
router.get(
  '/hip/records/status/:id',
  requireRole(ROLES.PATIENT, ROLES.DOCTOR, ROLES.ADMIN),
  validate({ params: idParamSchema }),
  getHipRecordStatus
);

// HIU & Consent
router.post('/hiu/discover', requireRole(ROLES.PATIENT), validate({ body: hiuDiscoverBodySchema }), postHiuDiscover);
router.post(
  '/hiu/consent-request',
  requireRole(ROLES.PATIENT, ROLES.DOCTOR),
  validate({ body: hiuConsentRequestBodySchema }),
  postHiuConsentRequest
);
router.get('/hiu/consents/my', requireRole(ROLES.PATIENT), getMyHiuConsents);
router.get('/hiu/consent/:id', requireRole(ROLES.PATIENT, ROLES.DOCTOR, ROLES.ADMIN), validate({ params: idParamSchema }), getHiuConsent);
router.post('/hiu/consent/:id/revoke', requireRole(ROLES.PATIENT), validate({ params: idParamSchema }), postHiuConsentRevoke);
router.post(
  '/hiu/data-request',
  requireRole(ROLES.PATIENT, ROLES.DOCTOR),
  validate({ body: hiuDataRequestBodySchema }),
  postHiuDataRequest
);
router.get('/hiu/exchange/:id', requireRole(ROLES.PATIENT, ROLES.DOCTOR, ROLES.ADMIN), validate({ params: idParamSchema }), getHiuExchange);
router.get('/hiu/imports/my', requireRole(ROLES.PATIENT), getMyHiuImports);

// Admin ABDM Dashboard & Registry Review
router.get('/admin/dashboard', requireRole(ROLES.ADMIN), getAdminAbdmDashboard);
router.patch(
  '/admin/registry/:id/review',
  requireRole(ROLES.ADMIN),
  validate({ params: idParamSchema, body: reviewRegistryBodySchema }),
  patchAdminRegistryReview
);

export default router;
