import { Router } from 'express';
import { z } from 'zod';
import { requireActiveAccount, requireAuth } from '../../../middleware/auth.middleware.js';
import { validate } from '../../../middleware/validate.middleware.js';
import { ApiError } from '../../../utils/ApiError.js';
import { ApiResponse } from '../../../utils/ApiResponse.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { abdmRepository } from '../../abdm/abdm.repository.js';
import { clinicRepository } from '../../clinics/clinic.repository.js';
import { consultationRepository } from '../../consultations/consultation.repository.js';
import { doctorRepository } from '../../doctors/doctor.repository.js';
import { medicalRecordRepository } from '../../medicalRecords/medicalRecord.repository.js';
import { patientRepository } from '../../patients/patient.repository.js';
import { prescriptionRepository } from '../../prescriptions/prescription.repository.js';
import { ROLES } from '../../users/user.constants.js';
import { userRepository } from '../../users/user.repository.js';
import { buildFhirBundle } from './fhir.bundle.service.js';
import { validateFhirResource } from './fhir.validator.js';

const router = Router();
router.use(requireAuth, requireActiveAccount);

const convertBodySchema = z
  .object({
    recordSourceType: z.enum(['PRESCRIPTION', 'CONSULTATION', 'MEDICAL_RECORD']),
    recordId: z.string().trim().min(1).max(64),
  })
  .strict();

const recordIdParamSchema = z.object({ id: z.string().trim().min(1).max(64) }).strict();

const loadAuthorizedRecord = async (user, recordSourceType, recordId) => {
  let record = null;
  if (recordSourceType === 'PRESCRIPTION') record = await prescriptionRepository.findById(recordId);
  else if (recordSourceType === 'CONSULTATION') record = await consultationRepository.findById(recordId);
  else record = await medicalRecordRepository.findById(recordId);

  if (!record) throw new ApiError(404, 'Health record not found', 'RECORD_NOT_FOUND');

  if (user.role === ROLES.PATIENT) {
    if (String(record.patientId) !== String(user._id)) throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  } else if (user.role === ROLES.DOCTOR) {
    const doctor = await doctorRepository.findByUserId(user._id);
    if (!doctor || (record.doctorId && String(record.doctorId) !== String(doctor._id))) {
      throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
    }
  } else if (user.role !== ROLES.ADMIN) {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }

  const [patientUser, patientProfile, abhaLink, doctor, clinic] = await Promise.all([
    userRepository.findById(record.patientId),
    patientRepository.findByUserId(record.patientId),
    abdmRepository.findAbhaByPatientId(record.patientId),
    record.doctorId ? doctorRepository.findById(record.doctorId) : null,
    record.clinicId ? clinicRepository.findById(record.clinicId) : null,
  ]);
  const [hprLink, hfrLink] = await Promise.all([
    doctor ? abdmRepository.findRegistryLink('HPR', doctor._id) : null,
    clinic ? abdmRepository.findRegistryLink('HFR', clinic._id) : null,
  ]);

  return buildFhirBundle({
    recordSourceType,
    record,
    user: patientUser,
    patientProfile,
    doctor,
    clinic,
    abhaLink,
    hprLink,
    hfrLink,
  });
};

router.post(
  '/convert',
  validate({ body: convertBodySchema }),
  asyncHandler(async (req, res) => {
    const result = await loadAuthorizedRecord(req.currentUser, req.body.recordSourceType, req.body.recordId);
    return ApiResponse.send(res, { statusCode: 200, data: result, message: 'FHIR bundle generated' });
  })
);

router.post(
  '/validate',
  asyncHandler(async (req, res) => {
    const result = validateFhirResource(req.body);
    const statusCode = result.valid ? 200 : 422;
    return ApiResponse.send(res, {
      statusCode,
      data: result,
      message: result.valid ? 'FHIR resource is valid' : 'FHIR validation failed',
    });
  })
);

router.get(
  '/records/:id',
  validate({ params: recordIdParamSchema }),
  asyncHandler(async (req, res) => {
    const sourceType = String(req.query.type || 'MEDICAL_RECORD').toUpperCase();
    if (!['PRESCRIPTION', 'CONSULTATION', 'MEDICAL_RECORD'].includes(sourceType)) {
      throw new ApiError(400, 'Invalid record type query parameter', 'INVALID_RECORD_TYPE');
    }
    const result = await loadAuthorizedRecord(req.currentUser, sourceType, req.params.id);
    return ApiResponse.send(res, { statusCode: 200, data: result, message: 'FHIR bundle retrieved' });
  })
);

export default router;
