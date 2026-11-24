import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import { APPOINTMENT_PAYMENT_STATUS, APPOINTMENT_STATUS } from '../appointments/appointment.constants.js';
import { appointmentRepository } from '../appointments/appointment.repository.js';
import { doctorRepository } from '../doctors/doctor.repository.js';
import { ROLES } from '../users/user.constants.js';
import { agoraTokenService } from './token.service.js';
import { VIDEO_CONSULTATION_STATUS } from './videoConsultation.model.js';
import { videoConsultationRepository } from './videoConsultation.repository.js';

const JOIN_EARLY_MS = 15 * 60 * 1000;
const JOIN_LATE_MS = 30 * 60 * 1000;

export const EMERGENCY_TELEMEDICINE_NOTICE =
  'MediBook video consultations are not for medical emergencies. In case of an emergency, seek immediate in-person emergency care.';

const deriveNumericUid = (userId) => {
  const hash = crypto.createHash('sha256').update(String(userId)).digest();
  return (hash.readUInt32BE(0) % 2_000_000_000) + 1;
};

export const generateConsultationToken = async (user, appointmentId, { telemedicineConsentAccepted, emergencyNoticeAcknowledged } = {}) => {
  if (!env.VIDEO_CONSULTATION_ENABLED || !env.AGORA_ENABLED) {
    throw new ApiError(503, 'Video consultations are currently disabled', 'VIDEO_DISABLED');
  }
  if (!telemedicineConsentAccepted || !emergencyNoticeAcknowledged) {
    throw new ApiError(
      400,
      'Telemedicine consent and emergency notice acknowledgement are required',
      'TELEMEDICINE_CONSENT_REQUIRED'
    );
  }

  const appt = await appointmentRepository.findById(appointmentId);
  if (!appt) throw new ApiError(404, 'Appointment not found', 'APPOINTMENT_NOT_FOUND');

  let isAuthorized = false;
  if (user.role === ROLES.PATIENT && String(appt.patientId) === String(user._id)) {
    isAuthorized = true;
  } else if (user.role === ROLES.DOCTOR) {
    const doc = await doctorRepository.findByUserId(user._id);
    if (doc && String(appt.doctorId) === String(doc._id)) {
      isAuthorized = true;
    }
  }
  if (!isAuthorized) {
    throw new ApiError(403, 'You are not authorized to join this video consultation', 'FORBIDDEN');
  }

  if (appt.consultationMode !== 'VIDEO' && appt.consultationMode !== 'AUDIO') {
    throw new ApiError(409, 'Video consultation is only available for online appointments', 'NOT_ONLINE_CONSULTATION');
  }
  if (appt.status === APPOINTMENT_STATUS.PAYMENT_PENDING || appt.paymentStatus === APPOINTMENT_PAYMENT_STATUS.PENDING) {
    throw new ApiError(402, 'Payment must be completed before joining the consultation', 'PAYMENT_REQUIRED');
  }
  if (appt.status !== APPOINTMENT_STATUS.CONFIRMED) {
    throw new ApiError(409, `Cannot join consultation for appointment in ${appt.status} status`, 'INVALID_APPOINTMENT_STATUS');
  }

  const doctor = await doctorRepository.findById(appt.doctorId);
  if (!doctor || !doctor.isVerified || doctor.profileStatus !== 'PUBLISHED') {
    throw new ApiError(403, 'Doctor is not verified or active for telemedicine', 'DOCTOR_NOT_ELIGIBLE');
  }

  const now = Date.now();
  const startMs = new Date(appt.startAt).getTime();
  const endMs = new Date(appt.endAt).getTime();
  if (now < startMs - JOIN_EARLY_MS) {
    throw new ApiError(409, 'Consultation room is not open yet (opens 15 minutes before start)', 'CONSULTATION_NOT_STARTED');
  }
  if (now > endMs + JOIN_LATE_MS) {
    throw new ApiError(409, 'Consultation joining window has expired', 'CONSULTATION_WINDOW_EXPIRED');
  }

  const consentField =
    user.role === ROLES.PATIENT
      ? { 'telemedicineConsent.patientConsentedAt': new Date() }
      : { 'telemedicineConsent.doctorConfirmedAt': new Date() };

  const room = await videoConsultationRepository.upsertForAppointment(
    appt._id,
    {
      appointmentId: appt._id,
      patientId: appt.patientId,
      doctorId: appt.doctorId,
      channelName: `mb_vc_${crypto.randomBytes(12).toString('hex')}`,
      status: VIDEO_CONSULTATION_STATUS.IN_PROGRESS,
      scheduledAt: appt.startAt,
      startedAt: new Date(),
      roomExpiresAt: new Date(endMs + JOIN_LATE_MS),
    },
    {
      ...consentField,
      'telemedicineConsent.emergencyNoticeAcknowledged': true,
    }
  );

  const uid = deriveNumericUid(user._id);
  const { appId, token, expiresAt } = agoraTokenService.generateRtcToken({
    channelName: room.channelName,
    uid,
  });

  return {
    consultationId: String(room._id),
    appointmentId: String(appt._id),
    channelName: room.channelName,
    appId,
    token,
    uid,
    expiresAt,
    status: room.status,
    emergencyNotice: EMERGENCY_TELEMEDICINE_NOTICE,
  };
};

export const completeVideoConsultation = async (user, appointmentId) => {
  const doctor = await doctorRepository.findByUserId(user._id);
  const appt = await appointmentRepository.findById(appointmentId);
  if (!appt) throw new ApiError(404, 'Appointment not found', 'APPOINTMENT_NOT_FOUND');
  if (!doctor || String(appt.doctorId) !== String(doctor._id)) {
    throw new ApiError(403, 'Only the assigned doctor can complete this video consultation', 'FORBIDDEN');
  }

  const updated = await videoConsultationRepository.updateByAppointmentId(appt._id, {
    status: VIDEO_CONSULTATION_STATUS.COMPLETED,
    endedAt: new Date(),
  });
  if (!updated) throw new ApiError(404, 'Video consultation session not found', 'VIDEO_CONSULTATION_NOT_FOUND');

  return {
    consultationId: String(updated._id),
    appointmentId: String(updated.appointmentId),
    status: updated.status,
    startedAt: updated.startedAt ?? null,
    endedAt: updated.endedAt,
  };
};
