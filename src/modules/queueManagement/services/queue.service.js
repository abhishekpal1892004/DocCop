import { ApiError } from '../../../utils/ApiError.js';
import { APPOINTMENT_STATUS } from '../../appointments/appointment.constants.js';
import { appointmentRepository } from '../../appointments/appointment.repository.js';
import { requireApprovedDoctorForUser } from '../../calendly/calendly.service.js';
import { QUEUE_ENTRY_STATUS } from '../models/queueEntry.model.js';
import { QUEUE_SESSION_STATUS } from '../models/queueSession.model.js';
import { queueRepository } from '../queue.repository.js';

const todayDateKey = () => new Date().toISOString().slice(0, 10);

export const toPublicQueueSession = (s) => ({
  id: String(s._id),
  doctorId: String(s.doctorId),
  clinicId: s.clinicId ? String(s.clinicId) : null,
  dateKey: s.dateKey,
  status: s.status,
  currentTokenNumber: s.currentTokenNumber ?? 0,
  averageConsultationMinutes: s.averageConsultationMinutes ?? 15,
  openedAt: s.openedAt,
  closedAt: s.closedAt ?? null,
});

export const toPublicQueueEntry = (e) => ({
  id: String(e._id),
  queueSessionId: String(e.queueSessionId),
  appointmentId: String(e.appointmentId),
  tokenNumber: e.tokenNumber,
  status: e.status,
  checkedInAt: e.checkedInAt,
  calledAt: e.calledAt ?? null,
  consultationStartedAt: e.consultationStartedAt ?? null,
  completedAt: e.completedAt ?? null,
});

export const openDoctorQueueSession = async (user, { clinicId, averageConsultationMinutes } = {}) => {
  const doctor = await requireApprovedDoctorForUser(user);
  const dateKey = todayDateKey();
  const existing = await queueRepository.findSessionByDoctorAndDate(doctor._id, dateKey);
  if (existing) {
    if (existing.status === QUEUE_SESSION_STATUS.CLOSED) {
      throw new ApiError(409, 'Today queue session is already closed', 'QUEUE_CLOSED');
    }
    return toPublicQueueSession(existing);
  }

  const created = await queueRepository.createSession({
    doctorId: doctor._id,
    clinicId: clinicId ?? doctor.primaryClinicId ?? null,
    dateKey,
    date: new Date(),
    status: QUEUE_SESSION_STATUS.OPEN,
    averageConsultationMinutes: averageConsultationMinutes ?? 15,
  });

  return toPublicQueueSession(created);
};

export const getCurrentDoctorQueue = async (user) => {
  const doctor = await requireApprovedDoctorForUser(user);
  const session = await queueRepository.findSessionByDoctorAndDate(doctor._id, todayDateKey());
  if (!session) {
    return { session: null, entries: [] };
  }
  const entries = await queueRepository.listEntriesForSession(session._id);
  return {
    session: toPublicQueueSession(session),
    entries: entries.map(toPublicQueueEntry),
  };
};

export const patientCheckIn = async (user, { appointmentId }) => {
  const appt = await appointmentRepository.findById(appointmentId);
  if (!appt) throw new ApiError(404, 'Appointment not found', 'APPOINTMENT_NOT_FOUND');
  if (String(appt.patientId) !== String(user._id)) {
    throw new ApiError(403, 'You can only check in for your own appointment', 'FORBIDDEN');
  }
  if (appt.consultationMode !== 'IN_PERSON') {
    throw new ApiError(409, 'Only in-person appointments can enter the clinic queue', 'NOT_IN_PERSON_APPOINTMENT');
  }
  if (appt.status !== APPOINTMENT_STATUS.CONFIRMED) {
    throw new ApiError(409, `Cannot check in for an appointment in ${appt.status} status`, 'INVALID_APPOINTMENT_STATUS');
  }

  const existingEntry = await queueRepository.findEntryByAppointmentId(appt._id);
  if (existingEntry) {
    throw new ApiError(409, 'Already checked in for this appointment', 'ALREADY_CHECKED_IN');
  }

  const dateKey = todayDateKey();
  const session = await queueRepository.findSessionByDoctorAndDate(appt.doctorId, dateKey);
  if (!session || session.status !== QUEUE_SESSION_STATUS.OPEN) {
    throw new ApiError(409, 'Clinic queue is not currently open for check-in', 'QUEUE_NOT_OPEN');
  }

  const allocated = await queueRepository.allocateNextToken(session._id);
  if (!allocated) {
    throw new ApiError(409, 'Clinic queue is not currently open', 'QUEUE_NOT_OPEN');
  }

  try {
    const entry = await queueRepository.createEntry({
      queueSessionId: session._id,
      appointmentId: appt._id,
      patientId: user._id,
      tokenNumber: allocated.nextTokenSequence,
      status: QUEUE_ENTRY_STATUS.WAITING,
      checkedInAt: new Date(),
    });

    return {
      entry: toPublicQueueEntry(entry),
      currentServingToken: allocated.currentTokenNumber ?? 0,
    };
  } catch (err) {
    if (err?.code === 11000) {
      throw new ApiError(409, 'Already checked in for this appointment', 'ALREADY_CHECKED_IN');
    }
    throw err;
  }
};

export const getPatientQueuePosition = async (user, { appointmentId }) => {
  const appt = await appointmentRepository.findById(appointmentId);
  if (!appt) throw new ApiError(404, 'Appointment not found', 'APPOINTMENT_NOT_FOUND');
  if (String(appt.patientId) !== String(user._id)) {
    throw new ApiError(403, 'You can only view your own queue position', 'FORBIDDEN');
  }

  const entry = await queueRepository.findEntryByAppointmentId(appt._id);
  if (!entry) throw new ApiError(404, 'Queue entry not found for this appointment', 'QUEUE_ENTRY_NOT_FOUND');

  const session = await queueRepository.findSessionById(entry.queueSessionId);
  const patientsAhead =
    entry.status === QUEUE_ENTRY_STATUS.WAITING
      ? await queueRepository.countWaitingAhead(entry.queueSessionId, entry.tokenNumber)
      : 0;
  const avgMins = session?.averageConsultationMinutes ?? 15;

  return {
    tokenNumber: entry.tokenNumber,
    status: entry.status,
    currentServingToken: session?.currentTokenNumber ?? 0,
    queueStatus: session?.status ?? 'OPEN',
    patientsAhead,
    estimatedWaitMinutes: patientsAhead * avgMins,
    isEstimate: true,
  };
};

const requireDoctorOwnsSession = async (user, sessionId) => {
  const doctor = await requireApprovedDoctorForUser(user);
  const session = await queueRepository.findSessionById(sessionId);
  if (!session) throw new ApiError(404, 'Queue session not found', 'QUEUE_SESSION_NOT_FOUND');
  if (String(session.doctorId) !== String(doctor._id)) {
    throw new ApiError(403, 'You are not authorized to manage this queue', 'FORBIDDEN');
  }
  return { doctor, session };
};

export const callNextPatient = async (user, sessionId) => {
  const { doctor, session } = await requireDoctorOwnsSession(user, sessionId);
  if (session.status !== QUEUE_SESSION_STATUS.OPEN) {
    throw new ApiError(409, `Cannot call next patient while queue is ${session.status}`, 'QUEUE_NOT_OPEN');
  }

  const entry = await queueRepository.claimNextWaitingEntry(session._id, new Date());
  if (!entry) {
    throw new ApiError(404, 'No waiting patients in queue', 'QUEUE_EMPTY');
  }

  const updatedSession = await queueRepository.updateSessionById(session._id, doctor._id, {
    currentTokenNumber: entry.tokenNumber,
  });

  return {
    session: toPublicQueueSession(updatedSession),
    entry: toPublicQueueEntry(entry),
  };
};

export const startQueueEntry = async (user, sessionId, entryId) => {
  const { session } = await requireDoctorOwnsSession(user, sessionId);
  const updated = await queueRepository.updateEntryStatus(
    entryId,
    session._id,
    [QUEUE_ENTRY_STATUS.CALLED, QUEUE_ENTRY_STATUS.WAITING],
    { status: QUEUE_ENTRY_STATUS.IN_CONSULTATION, consultationStartedAt: new Date() }
  );
  if (!updated) throw new ApiError(409, 'Queue entry cannot be started in its current state', 'INVALID_QUEUE_TRANSITION');
  return toPublicQueueEntry(updated);
};

export const completeQueueEntry = async (user, sessionId, entryId) => {
  const { session } = await requireDoctorOwnsSession(user, sessionId);
  const updated = await queueRepository.updateEntryStatus(
    entryId,
    session._id,
    [QUEUE_ENTRY_STATUS.IN_CONSULTATION, QUEUE_ENTRY_STATUS.CALLED],
    { status: QUEUE_ENTRY_STATUS.COMPLETED, completedAt: new Date() }
  );
  if (!updated) throw new ApiError(409, 'Queue entry cannot be completed in its current state', 'INVALID_QUEUE_TRANSITION');
  return toPublicQueueEntry(updated);
};

export const skipQueueEntry = async (user, sessionId, entryId) => {
  const { session } = await requireDoctorOwnsSession(user, sessionId);
  const updated = await queueRepository.updateEntryStatus(
    entryId,
    session._id,
    [QUEUE_ENTRY_STATUS.WAITING, QUEUE_ENTRY_STATUS.CALLED],
    { status: QUEUE_ENTRY_STATUS.SKIPPED }
  );
  if (!updated) throw new ApiError(409, 'Queue entry cannot be skipped in its current state', 'INVALID_QUEUE_TRANSITION');
  return toPublicQueueEntry(updated);
};

export const setQueueSessionStatus = async (user, sessionId, status) => {
  const { doctor } = await requireDoctorOwnsSession(user, sessionId);
  const updated = await queueRepository.updateSessionById(sessionId, doctor._id, {
    status,
    ...(status === QUEUE_SESSION_STATUS.CLOSED ? { closedAt: new Date() } : {}),
  });
  return toPublicQueueSession(updated);
};
