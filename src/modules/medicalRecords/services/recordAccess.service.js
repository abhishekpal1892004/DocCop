import { ApiError } from '../../../utils/ApiError.js';
import { appointmentRepository } from '../../appointments/appointment.repository.js';
import { AUDIT_ACTIONS, AUDIT_TARGET_TYPES } from '../../auditLogs/auditLog.constants.js';
import { recordAuditEvent } from '../../auditLogs/auditLog.service.js';
import { doctorRepository } from '../../doctors/doctor.repository.js';
import { ROLES } from '../../users/user.constants.js';
import { RECORD_STATUS, SCAN_STATUS } from '../medicalRecord.constants.js';
import { medicalRecordRepository } from '../medicalRecord.repository.js';

export const assertCanAccessMedicalRecord = async (user, record, requestId) => {
  if (!record || record.recordStatus !== RECORD_STATUS.ACTIVE) {
    throw new ApiError(404, 'Medical record not found', 'MEDICAL_RECORD_NOT_FOUND');
  }

  if (user.role === ROLES.PATIENT) {
    if (String(record.patientId) === String(user._id)) return;
  } else if (user.role === ROLES.DOCTOR) {
    if (record.scanStatus === SCAN_STATUS.INFECTED) {
      throw new ApiError(403, 'Quarantined document cannot be accessed', 'DOCUMENT_QUARANTINED');
    }
    const doctor = await doctorRepository.findByUserId(user._id);
    if (doctor && doctor.isVerified && doctor.profileStatus === 'PUBLISHED') {
      const explicit = await medicalRecordRepository.findActiveAccess(record._id, user._id);
      if (explicit) return;

      if (record.appointmentId) {
        const appt = await appointmentRepository.findById(record.appointmentId);
        if (appt && String(appt.doctorId) === String(doctor._id) && String(appt.patientId) === String(record.patientId)) {
          return;
        }
      }
    }
  }

  await recordAuditEvent({
    actorUserId: user._id,
    actorRole: user.role,
    action: AUDIT_ACTIONS.FAILED_AUTHORIZATION_ATTEMPT,
    targetType: AUDIT_TARGET_TYPES.MEDICAL_RECORD,
    targetId: record._id,
    outcome: 'DENIED',
    requestId,
    remarks: 'Unauthorized attempt to access medical record',
  });

  throw new ApiError(403, 'You are not authorized to access this medical record', 'FORBIDDEN');
};
