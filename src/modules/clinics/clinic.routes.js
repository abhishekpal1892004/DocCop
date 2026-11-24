import { Router } from 'express';
import { requireActiveAccount, requireAuth, requireRole } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { ROLES } from '../users/user.constants.js';
import { getClinicById, getMyAssociations, getVerifiedClinics, postDoctorAssociation } from './clinic.controller.js';
import { clinicIdParamSchema, doctorAssociateClinicSchema, listClinicsQuerySchema } from './clinic.validation.js';
import { clinicStaffRoutes } from '../staffManagement/staff.routes.js';

const router = Router();

router.use(requireAuth, requireActiveAccount);

router.get('/verified', validate({ query: listClinicsQuerySchema }), getVerifiedClinics);
router.post('/associations', requireRole(ROLES.DOCTOR), validate({ body: doctorAssociateClinicSchema }), postDoctorAssociation);
router.get('/associations/me', requireRole(ROLES.DOCTOR), getMyAssociations);
router.use('/:id/staff', clinicStaffRoutes);
router.get('/:id', validate({ params: clinicIdParamSchema }), getClinicById);

export default router;
