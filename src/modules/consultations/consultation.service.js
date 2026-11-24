import { ApiError } from '../../utils/ApiError.js';
import { APPOINTMENT_STATUS } from '../appointments/appointment.constants.js';
import { appointmentRepository } from '../appointments/appointment.repository.js';
import { AUDIT_ACTIONS, AUDIT_TARGET_TYPES } from '../auditLogs/auditLog.constants.js';
import { recordAuditEvent } from '../auditLogs/auditLog.service.js';
import { requireApprovedDoctorForUser } from '../calendly/calendly.service.js';
import { doctorRepository } from '../doctors/doctor.repository.js';
import { ROLES } from '../users/user.constants.js';
import { CONSULTATION_STATUS } from './consultation.model.js';
import { consultationRepository } from './consultation.repository.js';

export const toPublicConsultation = (c) => ({
  id: String(c._id),
  appointmentId: String(c.appointmentId),
  patientId: String(c.patientId),
  doctorId: String(c.doctorId),
  clinicId: c.clinicId ? String(c.clinicId) : null,
  consultationDate: c.consultationDate,
  notes: c.notes ?? '',
  followUpInstructions: c.followUpInstructions ?? '',
  prescriptionIds: (c.prescriptionIds ?? []).map(String),
  status: c.status,
  completedAt: c.completedAt ?? null,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
});

export const createConsultation = async (user, input, requestId) => {
  const doctor = await requireApprovedDoctorForUser(user);
  const appointment = await appointmentRepository.findById(input.appointmentId);
  if (!appointment) {
    throw new ApiError(404, 'Appointment not found', 'APPOINTMENT_NOT_FOUND');
  }
  if (String(appointment.doctorId) !== String(doctor._id)) {
    throw new ApiError(403, 'You can only create consultation records for your own appointments', 'FORBIDDEN');
  }
  if (appointment.status !== APPOINTMENT_STATUS.CONFIRMED && appointment.status !== APPOINTMENT_STATUS.COMPLETED) {
    throw new ApiError(
      409,
      `Cannot create consultation for an appointment in ${appointment.status} status`,
      'INVALID_APPOINTMENT_STATUS'
    );
  }

  const existing = await consultationRepository.findByAppointmentId(appointment._id);
  if (existing) {
    throw new ApiError(409, 'Consultation record already exists for this appointment', 'CONSULTATION_EXISTS');
  }

  const created = await consultationRepository.create({
    appointmentId: appointment._id,
    patientId: appointment.patientId,
    doctorId: doctor._id,
    clinicId: appointment.clinicId ?? doctor.primaryClinicId ?? null,
    consultationDate: appointment.startAt,
    notes: input.notes ?? '',
    followUpInstructions: input.followUpInstructions ?? '',
    status: CONSULTATION_STATUS.IN_PROGRESS,
  });

  await recordAuditEvent({
    actorUserId: user._id,
    actorRole: user.role,
    action: AUDIT_ACTIONS.CONSULTATION_CREATED,
    targetType: AUDIT_TARGET_TYPES.CONSULTATION,
    targetId: created._id,
    newStatus: CONSULTATION_STATUS.IN_PROGRESS,
    requestId,
  });

  return toPublicConsultation(created);
};

export const updateConsultation = async (user, id, input) => {
  const doctor = await requireApprovedDoctorForUser(user);
  const existing = await consultationRepository.findById(id);
  if (!existing) throw new ApiError(404, 'Consultation record not found', 'CONSULTATION_NOT_FOUND');
  if (String(existing.doctorId) !== String(doctor._id)) {
    throw new ApiError(403, 'You can only update your own consultation records', 'FORBIDDEN');
  }
  if (existing.status === CONSULTATION_STATUS.COMPLETED || existing.status === CONSULTATION_STATUS.CANCELLED) {
    throw new ApiError(409, `Cannot edit a consultation in ${existing.status} status`, 'CONSULTATION_LOCKED');
  }
  const updated = await consultationRepository.updateById(id, doctor._id, input);
  return toPublicConsultation(updated);
};

export const completeConsultation = async (user, id, requestId) => {
  const doctor = await requireApprovedDoctorForUser(user);
  const existing = await consultationRepository.findById(id);
  if (!existing) throw new ApiError(404, 'Consultation record not found', 'CONSULTATION_NOT_FOUND');
  if (String(existing.doctorId) !== String(doctor._id)) {
    throw new ApiError(403, 'You can only complete your own consultation records', 'FORBIDDEN');
  }
  if (existing.status !== CONSULTATION_STATUS.IN_PROGRESS && existing.status !== CONSULTATION_STATUS.SCHEDULED) {
    throw new ApiError(409, `Cannot complete a consultation in ${existing.status} status`, 'INVALID_CONSULTATION_STATUS');
  }

  const now = new Date();
  const updated = await consultationRepository.updateById(id, doctor._id, {
    status: CONSULTATION_STATUS.COMPLETED,
    completedAt: now,
  });

  await appointmentRepository.updateById(existing.appointmentId, { status: APPOINTMENT_STATUS.COMPLETED });

  await recordAuditEvent({
    actorUserId: user._id,
    actorRole: user.role,
    action: AUDIT_ACTIONS.CONSULTATION_COMPLETED,
    targetType: AUDIT_TARGET_TYPES.CONSULTATION,
    targetId: updated._id,
    previousStatus: existing.status,
    newStatus: CONSULTATION_STATUS.COMPLETED,
    requestId,
  });

  return toPublicConsultation(updated);
};

export const getConsultationById = async (user, id) => {
  const c = await consultationRepository.findById(id);
  if (!c) throw new ApiError(404, 'Consultation record not found', 'CONSULTATION_NOT_FOUND');
  if (user.role === ROLES.PATIENT && String(c.patientId) === String(user._id) && c.status === CONSULTATION_STATUS.COMPLETED) {
    return toPublicConsultation(c);
  }
  if (user.role === ROLES.DOCTOR) {
    const doctor = await doctorRepository.findByUserId(user._id);
    if (doctor && String(c.doctorId) === String(doctor._id)) return toPublicConsultation(c);
  }
  throw new ApiError(403, 'You are not authorized to access this consultation record', 'FORBIDDEN');
};

export const listPatientConsultations = async (user, query) => {
  const result = await consultationRepository.listByPatient(user._id, query);
  return {
    consultations: result.items.map(toPublicConsultation),
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / result.limit) || 0,
    },
  };
};

export const listDoctorConsultations = async (user, query) => {
  const doctor = await requireApprovedDoctorForUser(user);
  const result = await consultationRepository.listByDoctor(doctor._id, query);
  return {
    consultations: result.items.map(toPublicConsultation),
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / result.limit) || 0,
    },
  };
};
