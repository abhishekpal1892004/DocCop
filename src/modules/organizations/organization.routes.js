import { Router } from 'express';
import { requireActiveAccount, requireAuth, requireRole } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { ROLES } from '../users/user.constants.js';
import {
  getOrganizationClinics,
  getOwnOrganization,
  patchOwnOrganization,
  postAddOrganizationClinic,
  postCreateOrganization,
} from './organization.controller.js';
import {
  addOrganizationClinicBodySchema,
  createOrganizationBodySchema,
  organizationIdParamSchema,
  updateOrganizationBodySchema,
} from './organization.validation.js';

const router = Router();

router.use(requireAuth, requireActiveAccount);

router.post(
  '/',
  requireRole(ROLES.DOCTOR, ROLES.CLINIC_MANAGER, ROLES.ADMIN),
  validate({ body: createOrganizationBodySchema }),
  postCreateOrganization
);
router.get('/me', getOwnOrganization);
router.patch('/me', validate({ body: updateOrganizationBodySchema }), patchOwnOrganization);
router.post(
  '/:id/clinics',
  validate({ params: organizationIdParamSchema, body: addOrganizationClinicBodySchema }),
  postAddOrganizationClinic
);
router.get('/:id/clinics', validate({ params: organizationIdParamSchema }), getOrganizationClinics);

export default router;
