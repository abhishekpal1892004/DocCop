import mongoose from 'mongoose';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import { calendlyClient, CalendlyProviderError } from '../../integrations/calendly/calendly.client.js';
import { formatDisplayTime } from '../../integrations/calendly/calendly.mapper.js';
import { calendlyTokenService } from '../../integrations/calendly/calendly.token.service.js';
import { calendlyRepository } from '../calendly/calendly.repository.js';
import { getValidCalendlyAccess, requireApprovedDoctorForUser } from '../calendly/calendly.service.js';
import { doctorRepository } from '../doctors/doctor.repository.js';
import { NOTIFICATION_EVENT_TYPES } from '../notifications/notification.constants.js';
import { emitAppointmentNotificationEvent } from '../notifications/services/notification.service.js';
import { ROLES } from '../users/user.constants.js';
import { APPOINTMENT_PAYMENT_STATUS, APPOINTMENT_STATUS, BOOKING_ATTEMPT_STATUS } from './appointment.constants.js';
import { appointmentRepository } from './appointment.repository.js';

export const toPublicAppointment = (appt) => ({
  id: String(appt._id),
  patientId: String(appt.patientId),
  doctorId: String(appt.doctorId),
  clinicId: appt.clinicId ? String(appt.clinicId) : null,
  appointmentTypeId: String(appt.appointmentTypeId),
  provider: appt.provider,
  calendlyEventUri: appt.calendlyEventUri ?? null,
  calendlyInviteeUri: appt.calendlyInviteeUri ?? null,
  startAt: appt.startAt,
  endAt: appt.endAt,
  displayTime: formatDisplayTime(appt.startAt, appt.timezone ?? 'UTC'),
  timezone: appt.timezone ?? 'UTC',
  status: appt.status,
  cancellationReason: appt.cancellationReason ?? null,
  rescheduledFromId: appt.rescheduledFromId ? String(appt.rescheduledFromId) : null,
  rescheduledToId: appt.rescheduledToId ? String(appt.rescheduledToId) : null,
  consultationMode: appt.consultationMode ?? 'IN_PERSON',
  consultationFee: appt.consultationFee ?? 0,
  paymentStatus: appt.paymentStatus ?? APPOINTMENT_PAYMENT_STATUS.NOT_REQUIRED,
  paymentDeadlineAt: appt.paymentDeadlineAt ?? null,
  createdAt: appt.createdAt,
  updatedAt: appt.updatedAt,
});

const runWithOptionalTransaction = async (fn) => {
  if (mongoose.connection?.readyState !== 1) return fn(undefined);
  const session = await mongoose.startSession();
  try {
    let result;
    try {
      await session.withTransaction(async () => {
        result = await fn(session);
      });
      return result;
    } catch (err) {
      const msg = String(err?.message ?? '');
      if (err?.code === 20 || msg.includes('Transaction numbers are only allowed on a replica set')) {
        return fn(undefined);
      }
      throw err;
    }
  } finally {
    await session.endSession();
  }
};

export const bookAppointment = async (user, { doctorId, appointmentTypeId, startTime, timezone, payOnline = false }, idempotencyKey) => {
  if (!idempotencyKey || String(idempotencyKey).trim().length < 8) {
    throw new ApiError(400, 'Idempotency-Key header (min 8 chars) is required', 'IDEMPOTENCY_KEY_REQUIRED');
  }
  const key = String(idempotencyKey).trim();

  const existingAttempt = await appointmentRepository.findAttemptByKey(user._id, key);
  if (existingAttempt) {
    if (existingAttempt.status === BOOKING_ATTEMPT_STATUS.CONFIRMED && existingAttempt.appointmentId) {
      const appt = await appointmentRepository.findById(existingAttempt.appointmentId);
      if (appt) return { appointment: toPublicAppointment(appt), created: false };
    }
    if (
      existingAttempt.status === BOOKING_ATTEMPT_STATUS.PENDING_EXTERNAL ||
      existingAttempt.status === BOOKING_ATTEMPT_STATUS.VERIFYING
    ) {
      throw new ApiError(409, 'Booking attempt is already in progress or awaiting reconciliation', 'BOOKING_IN_PROGRESS');
    }
    throw new ApiError(409, 'This idempotency key was already used for a failed booking attempt', 'IDEMPOTENCY_KEY_EXHAUSTED');
  }

  if (startTime.getTime() <= Date.now()) {
    throw new ApiError(400, 'Cannot book an appointment in the past', 'INVALID_START_TIME');
  }

  const doctor = await doctorRepository.findById(doctorId);
  if (!doctor || !doctor.isVerified || doctor.profileStatus !== 'PUBLISHED') {
    throw new ApiError(404, 'Approved published doctor not found', 'DOCTOR_NOT_FOUND');
  }

  const appointmentType = await calendlyRepository.findAppointmentTypeById(appointmentTypeId);
  if (!appointmentType || String(appointmentType.doctorId) !== String(doctor._id) || !appointmentType.isActive) {
    throw new ApiError(404, 'Active appointment type not found for this doctor', 'APPOINTMENT_TYPE_NOT_FOUND');
  }

  const { accessToken } = await getValidCalendlyAccess(doctor._id);

  let attempt;
  try {
    attempt = await appointmentRepository.createAttempt({
      patientId: user._id,
      doctorId: doctor._id,
      appointmentTypeId: appointmentType._id,
      idempotencyKey: key,
      requestedStartAt: startTime,
      status: BOOKING_ATTEMPT_STATUS.PENDING_EXTERNAL,
    });
  } catch (err) {
    if (err?.code === 11000) {
      throw new ApiError(409, 'Duplicate booking request in progress', 'BOOKING_IN_PROGRESS');
    }
    throw err;
  }

  const startIso = startTime.toISOString();
  const endAt = new Date(startTime.getTime() + appointmentType.durationMinutes * 60_000);

  let providerRes;
  try {
    providerRes = await calendlyClient.createInvitee(accessToken, {
      event_type: appointmentType.calendlyEventTypeUri,
      start_time: startIso,
      invitee: {
        name: user.fullName || user.email,
        email: user.email,
        timezone,
      },
    });
  } catch (err) {
    if (err instanceof CalendlyProviderError && err.isTimeout) {
      await appointmentRepository.updateAttemptById(attempt._id, {
        status: BOOKING_ATTEMPT_STATUS.VERIFYING,
      });
      await appointmentRepository.create({
        patientId: user._id,
        doctorId: doctor._id,
        clinicId: doctor.primaryClinicId ?? null,
        appointmentTypeId: appointmentType._id,
        provider: 'CALENDLY',
        startAt: startTime,
        endAt,
        timezone,
        status: APPOINTMENT_STATUS.REQUIRES_RECONCILIATION,
      });
      throw new ApiError(
        504,
        'Booking provider timed out; your request is queued for reconciliation. Please check your appointments before retrying.',
        'BOOKING_RECONCILIATION_REQUIRED'
      );
    }

    await appointmentRepository.updateAttemptById(attempt._id, {
      status: BOOKING_ATTEMPT_STATUS.FAILED,
    });

    if (err instanceof CalendlyProviderError && err.statusCode === 409) {
      throw new ApiError(
        409,
        'Selected time is no longer available. Please refresh available slots and choose another time.',
        'SLOT_UNAVAILABLE'
      );
    }
    if (err instanceof CalendlyProviderError) {
      throw new ApiError(err.statusCode, err.message, err.code);
    }
    throw err;
  }

  const resource = providerRes?.resource ?? providerRes ?? {};
  const inviteeUri = resource.uri;
  const eventUri = resource.event;

  const requiresPayment = Boolean(payOnline && env.PAYMENT_ENABLED && (appointmentType.consultationFee ?? 0) > 0);
  const paymentDeadlineAt = requiresPayment
    ? new Date(Date.now() + env.RAZORPAY_PAYMENT_TIMEOUT_MINUTES * 60_000)
    : null;

  try {
    const appointment = await runWithOptionalTransaction(async (session) => {
      const created = await appointmentRepository.create(
        {
          patientId: user._id,
          doctorId: doctor._id,
          clinicId: doctor.primaryClinicId ?? null,
          appointmentTypeId: appointmentType._id,
          provider: 'CALENDLY',
          calendlyEventUri: eventUri,
          calendlyInviteeUri: inviteeUri,
          startAt: startTime,
          endAt,
          timezone,
          consultationMode: appointmentType.consultationMode ?? 'IN_PERSON',
          consultationFee: appointmentType.consultationFee ?? 0,
          status: requiresPayment ? APPOINTMENT_STATUS.PAYMENT_PENDING : APPOINTMENT_STATUS.CONFIRMED,
          paymentStatus: requiresPayment ? APPOINTMENT_PAYMENT_STATUS.PENDING : APPOINTMENT_PAYMENT_STATUS.NOT_REQUIRED,
          paymentDeadlineAt,
          cancelUrlEncrypted: resource.cancel_url ? calendlyTokenService.encrypt(resource.cancel_url) : undefined,
          rescheduleUrlEncrypted: resource.reschedule_url
            ? calendlyTokenService.encrypt(resource.reschedule_url)
            : undefined,
        },
        { session }
      );

      await appointmentRepository.updateAttemptById(
        attempt._id,
        { status: BOOKING_ATTEMPT_STATUS.CONFIRMED, appointmentId: created._id },
        { session }
      );

      return created;
    });

    if (!requiresPayment) {
      await emitAppointmentNotificationEvent({
        appointment,
        eventType: NOTIFICATION_EVENT_TYPES.APPOINTMENT_CONFIRMED,
      });
    }

    return { appointment: toPublicAppointment(appointment), created: true };
  } catch (err) {
    // Provider succeeded but local persistence failed -> mark for reconciliation, never retry booking!
    await appointmentRepository.updateAttemptById(attempt._id, {
      status: BOOKING_ATTEMPT_STATUS.VERIFYING,
    });
    throw err;
  }
};

const buildAppointmentFilter = (baseFilter, { tab, from, to }) => {
  const filter = { ...baseFilter };
  const now = new Date();
  if (tab === 'upcoming') {
    filter.status = APPOINTMENT_STATUS.CONFIRMED;
    filter.startAt = { $gte: now };
  } else if (tab === 'past') {
    filter.startAt = { $lt: now };
    filter.status = { $in: [APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.COMPLETED, APPOINTMENT_STATUS.NO_SHOW] };
  } else if (tab === 'cancelled') {
    filter.status = APPOINTMENT_STATUS.CANCELLED;
  } else if (tab === 'rescheduled') {
    filter.status = APPOINTMENT_STATUS.RESCHEDULED;
  }

  if (from || to) {
    filter.startAt = {
      ...(filter.startAt ?? {}),
      ...(from ? { $gte: from } : {}),
      ...(to ? { $lte: to } : {}),
    };
  }
  return filter;
};

export const listPatientAppointments = async (user, query) => {
  const filter = buildAppointmentFilter({ patientId: user._id }, query);
  const result = await appointmentRepository.list(filter, {
    sortDir: query.sortBy === 'asc' ? 1 : -1,
    page: query.page,
    limit: query.limit,
  });
  return {
    appointments: result.items.map(toPublicAppointment),
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / result.limit) || 0,
    },
  };
};

export const listDoctorAppointments = async (user, query) => {
  const doctor = await requireApprovedDoctorForUser(user);
  const filter = buildAppointmentFilter({ doctorId: doctor._id }, query);
  const result = await appointmentRepository.list(filter, {
    sortDir: query.sortBy === 'asc' ? 1 : -1,
    page: query.page,
    limit: query.limit,
  });
  return {
    appointments: result.items.map(toPublicAppointment),
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / result.limit) || 0,
    },
  };
};

const assertAppointmentOwner = async (user, appointment) => {
  if (user.role === ROLES.PATIENT && String(appointment.patientId) === String(user._id)) {
    return;
  }
  if (user.role === ROLES.DOCTOR) {
    const doctor = await doctorRepository.findByUserId(user._id);
    if (doctor && String(appointment.doctorId) === String(doctor._id)) {
      return;
    }
  }
  throw new ApiError(403, 'You do not have access to this appointment', 'FORBIDDEN');
};

export const getAppointmentDetails = async (user, id) => {
  const appt = await appointmentRepository.findById(id);
  if (!appt) throw new ApiError(404, 'Appointment not found', 'APPOINTMENT_NOT_FOUND');
  await assertAppointmentOwner(user, appt);
  return toPublicAppointment(appt);
};

export const cancelAppointment = async (user, id, { reason }) => {
  const appt = await appointmentRepository.findById(id);
  if (!appt) throw new ApiError(404, 'Appointment not found', 'APPOINTMENT_NOT_FOUND');
  await assertAppointmentOwner(user, appt);

  if (appt.status === APPOINTMENT_STATUS.CANCELLED) {
    throw new ApiError(409, 'Appointment is already cancelled', 'ALREADY_CANCELLED');
  }
  if (appt.status !== APPOINTMENT_STATUS.CONFIRMED) {
    throw new ApiError(409, `Cannot cancel an appointment in ${appt.status} status`, 'INVALID_APPOINTMENT_STATUS');
  }
  if (!appt.calendlyEventUri) {
    throw new ApiError(409, 'Appointment has no provider event reference', 'PROVIDER_REFERENCE_MISSING');
  }

  const { accessToken } = await getValidCalendlyAccess(appt.doctorId);
  try {
    await calendlyClient.cancelScheduledEvent(accessToken, appt.calendlyEventUri, reason);
  } catch (err) {
    if (err instanceof CalendlyProviderError) {
      throw new ApiError(err.statusCode, err.message, err.code);
    }
    throw err;
  }

  const updated = await appointmentRepository.updateById(appt._id, {
    status: APPOINTMENT_STATUS.CANCELLED,
    cancellationReason: reason,
  });

  await emitAppointmentNotificationEvent({
    appointment: updated,
    eventType: NOTIFICATION_EVENT_TYPES.APPOINTMENT_CANCELLED,
  });

  return toPublicAppointment(updated);
};

export const startRescheduleAppointment = async (user, id) => {
  const appt = await appointmentRepository.findById(id);
  if (!appt) throw new ApiError(404, 'Appointment not found', 'APPOINTMENT_NOT_FOUND');
  if (String(appt.patientId) !== String(user._id)) {
    throw new ApiError(403, 'Only the booking patient can reschedule this appointment', 'FORBIDDEN');
  }
  if (appt.status !== APPOINTMENT_STATUS.CONFIRMED) {
    throw new ApiError(409, `Cannot reschedule an appointment in ${appt.status} status`, 'INVALID_APPOINTMENT_STATUS');
  }
  if (!appt.rescheduleUrlEncrypted) {
    throw new ApiError(
      409,
      'Reschedule URL is unavailable; rescheduling requires provider reconciliation',
      'RESCHEDULE_URL_UNAVAILABLE'
    );
  }

  const rescheduleUrl = calendlyTokenService.decrypt(appt.rescheduleUrlEncrypted);
  return {
    appointmentId: String(appt._id),
    status: appt.status,
    rescheduleUrl,
  };
};
