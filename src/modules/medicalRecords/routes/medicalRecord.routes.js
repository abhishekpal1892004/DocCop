import multer from 'multer';
import { Router } from 'express';
import { requireActiveAccount, requireAuth, requireRole } from '../../../middleware/auth.middleware.js';
import { validate } from '../../../middleware/validate.middleware.js';
import { ApiError } from '../../../utils/ApiError.js';
import { ROLES } from '../../users/user.constants.js';
import {
  deleteArchiveRecord,
  deleteRevokeShare,
  getDownloadRecord,
  getMyRecords,
  getRecordMetadata,
  patchRecordMetadata,
  postShareRecord,
  postUploadRecord,
} from '../controllers/medicalRecord.controller.js';
import { MAX_FILE_SIZE_BYTES } from '../medicalRecord.constants.js';
import {
  listMedicalRecordsQuerySchema,
  medicalRecordIdParamSchema,
  revokeShareParamsSchema,
  shareMedicalRecordBodySchema,
  updateMedicalRecordBodySchema,
  uploadMedicalRecordBodySchema,
} from '../validations/medicalRecord.validation.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 },
});

const handleUpload = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new ApiError(400, 'File exceeds maximum allowed size of 10 MB', 'FILE_TOO_LARGE'));
      }
      return next(new ApiError(400, err.message, 'UPLOAD_ERROR'));
    }
    return next(err);
  });
};

const router = Router();

router.use(requireAuth, requireActiveAccount);

router.post(
  '/',
  requireRole(ROLES.PATIENT, ROLES.DOCTOR),
  handleUpload,
  validate({ body: uploadMedicalRecordBodySchema }),
  postUploadRecord
);
router.get('/my', requireRole(ROLES.PATIENT), validate({ query: listMedicalRecordsQuerySchema }), getMyRecords);
router.get('/:id', requireRole(ROLES.PATIENT, ROLES.DOCTOR), validate({ params: medicalRecordIdParamSchema }), getRecordMetadata);
router.get('/:id/download', requireRole(ROLES.PATIENT, ROLES.DOCTOR), validate({ params: medicalRecordIdParamSchema }), getDownloadRecord);
router.patch(
  '/:id',
  requireRole(ROLES.PATIENT),
  validate({ params: medicalRecordIdParamSchema, body: updateMedicalRecordBodySchema }),
  patchRecordMetadata
);
router.delete('/:id', requireRole(ROLES.PATIENT), validate({ params: medicalRecordIdParamSchema }), deleteArchiveRecord);
router.post(
  '/:id/share',
  requireRole(ROLES.PATIENT),
  validate({ params: medicalRecordIdParamSchema, body: shareMedicalRecordBodySchema }),
  postShareRecord
);
router.delete(
  '/:id/share/:doctorId',
  requireRole(ROLES.PATIENT),
  validate({ params: revokeShareParamsSchema }),
  deleteRevokeShare
);

export default router;
