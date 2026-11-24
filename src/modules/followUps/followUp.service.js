import { ApiError } from '../../utils/ApiError.js';
import { appointmentRepository } from '../appointments/appointment.repository.js';
import { bookAppointment } from '../appointments/appointment.service.js';
import { requireApprovedDoctorForUser } from '../calendly/calendly.service.js';
import { doctorRepository } from '../doctors/doctor.repository.js';
import { ROLES } from '../users/user.constants.js';
import { FOLLOW_UP_STATUS } from './followUp.model.js';
import { followUpRepository } from './followUp.repository.js';

export const toPublicFollowUp = (f) => ({
  id: String(f._id),
  patientId: String(f.patientId),
  doctorId: String(f.doctorId),
  appointmentId: String(f.appointmentId),
  recommendedDate: f.recommendedDate,
  reason: f.reason ?? '',
  followUpType: f.followUpType,
  status: f.status,
  bookedAppointmentId: f.bookedAppointmentId ? String(f.bookedAppointmentId) : null,
  createdAt: f.createdAt,
});

export const createFollowUpRecommendation = async (user, input) => {
  const doctor = await requireApprovedDoctorForUser(user);
  const appt = await appointmentRepository.findById(input.appointmentId);
  if (!appt) throw new ApiError(404, 'Appointment not found', 'APPOINTMENT_NOT_FOUND');
  if (String(appt.doctorId) !== String(doctor._id)) {
    throw new ApiError(403, 'You can only create follow-ups for your own appointments', 'FORBIDDEN');
  }

  const created = await followUpRepository.create({
    patientId: appt.patientId,
    doctorId: doctor._id,
    appointmentId: appt._id,
    recommendedDate: input.recommendedDate,
    reason: input.reason ?? '',
    followUpType: input.followUpType,
    status: FOLLOW_UP_STATUS.PENDING,
    createdBy: user._id,
  });

  return toPublicFollowUp(created);
};

export const listPatientFollowUps = async (user) => {
  const items = await followUpRepository.listByPatient(user._id);
  return items.map(toPublicFollowUp);
};

export const listDoctorFollowUps = async (user) => {
  const doctor = await requireApprovedDoctorForUser(user);
  const items = await followUpRepository.listByDoctor(doctor._id);
  return items.map(toPublicFollowUp);
};

export const updateFollowUpStatus = async (user, id, { status }) => {
  const existing = await followUpRepository.findById(id);
  if (!existing) throw new ApiError(404, 'Follow-up not found', 'FOLLOW_UP_NOT_FOUND');

  if (user.role === ROLES.PATIENT) {
    if (String(existing.patientId) !== String(user._id)) throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
    if (status !== FOLLOW_UP_STATUS.CANCELLED) {
      throw new ApiError(403, 'Patients can only cancel a follow-up', 'FORBIDDEN');
    }
  } else if (user.role === ROLES.DOCTOR) {
    const doctor = await doctorRepository.findByUserId(user._id);
    if (!doctor || String(existing.doctorId) !== String(doctor._id)) {
      throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
    }
  } else {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }

  const updated = await followUpRepository.updateById(id, { status });
  return toPublicFollowUp(updated);
};

export const bookFollowUpAppointment = async (user, id, { appointmentTypeId, startTime, timezone }) => {
  const existing = await followUpRepository.findById(id);
  if (!existing) throw new ApiError(404, 'Follow-up not found', 'FOLLOW_UP_NOT_FOUND');
  if (String(existing.patientId) !== String(user._id)) {
    throw new ApiError(403, 'You can only book your own follow-up', 'FORBIDDEN');
  }
  if (existing.status !== FOLLOW_UP_STATUS.PENDING) {
    throw new ApiError(409, `Follow-up is already ${existing.status}`, 'FOLLOW_UP_NOT_PENDING');
  }

  const { appointment } = await bookAppointment(
    user,
    {
      doctorId: String(existing.doctorId),
      appointmentTypeId,
      startTime,
      timezone,
    },
    `followup-book-${existing._id}`
  );

  const updated = await followUpRepository.updateById(existing._id, {
    status: FOLLOW_UP_STATUS.SCHEDULED,
    bookedAppointmentId: appointment.id,
  });

  return { followUp: toPublicFollowUp(updated), appointment };
};
