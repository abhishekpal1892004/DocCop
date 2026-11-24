import { Router } from 'express';
import { requireActiveAccount, requireAuth, requireRole } from '../../../middleware/auth.middleware.js';
import { validate } from '../../../middleware/validate.middleware.js';
import { ROLES } from '../../users/user.constants.js';
import {
  getMyPrescriptions,
  getPrescription,
  getPrescriptionPdf,
  patchPrescriptionDraft,
  postAmendPrescription,
  postCreatePrescription,
  postIssuePrescription,
  postVoidPrescription,
} from '../controllers/prescription.controller.js';
import {
  amendPrescriptionBodySchema,
  createPrescriptionBodySchema,
  listPrescriptionsQuerySchema,
  prescriptionIdParamSchema,
  updatePrescriptionDraftBodySchema,
  voidPrescriptionBodySchema,
} from '../validations/prescription.validation.js';

const router = Router();

router.use(requireAuth, requireActiveAccount);

router.post('/', requireRole(ROLES.DOCTOR), validate({ body: createPrescriptionBodySchema }), postCreatePrescription);
router.get('/my', requireRole(ROLES.PATIENT), validate({ query: listPrescriptionsQuerySchema }), getMyPrescriptions);
router.get('/:id', requireRole(ROLES.PATIENT, ROLES.DOCTOR), validate({ params: prescriptionIdParamSchema }), getPrescription);
router.get('/:id/pdf', requireRole(ROLES.PATIENT, ROLES.DOCTOR), validate({ params: prescriptionIdParamSchema }), getPrescriptionPdf);
router.patch(
  '/:id',
  requireRole(ROLES.DOCTOR),
  validate({ params: prescriptionIdParamSchema, body: updatePrescriptionDraftBodySchema }),
  patchPrescriptionDraft
);
router.post('/:id/issue', requireRole(ROLES.DOCTOR), validate({ params: prescriptionIdParamSchema }), postIssuePrescription);
router.post(
  '/:id/amend',
  requireRole(ROLES.DOCTOR),
  validate({ params: prescriptionIdParamSchema, body: amendPrescriptionBodySchema }),
  postAmendPrescription
);
router.post(
  '/:id/void',
  requireRole(ROLES.DOCTOR),
  validate({ params: prescriptionIdParamSchema, body: voidPrescriptionBodySchema }),
  postVoidPrescription
);

export default router;
