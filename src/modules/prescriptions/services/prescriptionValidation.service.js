import { ApiError } from '../../../utils/ApiError.js';
import { APPOINTMENT_STATUS } from '../../appointments/appointment.constants.js';
import { appointmentRepository } from '../../appointments/appointment.repository.js';
import { requireApprovedDoctorForUser } from '../../calendly/calendly.service.js';

export const assertDoctorEligibleForAppointment = async (user, appointmentId) => {
  const doctor = await requireApprovedDoctorForUser(user);
  const appointment = await appointmentRepository.findById(appointmentId);
  if (!appointment) {
    throw new ApiError(404, 'Appointment not found', 'APPOINTMENT_NOT_FOUND');
  }
  if (String(appointment.doctorId) !== String(doctor._id)) {
    throw new ApiError(403, 'You can only prescribe for your own appointments', 'FORBIDDEN');
  }
  if (
    appointment.status !== APPOINTMENT_STATUS.CONFIRMED &&
    appointment.status !== APPOINTMENT_STATUS.COMPLETED
  ) {
    throw new ApiError(
      409,
      `Cannot create prescription for an appointment in ${appointment.status} status`,
      'INVALID_APPOINTMENT_STATUS'
    );
  }
  return { doctor, appointment };
};
