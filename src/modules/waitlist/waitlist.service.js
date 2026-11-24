import { ApiError } from '../../utils/ApiError.js';
import { bookAppointment } from '../appointments/appointment.service.js';
import { calendlyRepository } from '../calendly/calendly.repository.js';
import { getDoctorAvailability } from '../calendly/calendly.service.js';
import { doctorRepository } from '../doctors/doctor.repository.js';
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EVENT_TYPES,
  NOTIFICATION_PROVIDERS,
  NOTIFICATION_STATUS,
} from '../notifications/notification.constants.js';
import { notificationRepository } from '../notifications/notification.repository.js';
import { WAITLIST_STATUS } from './waitlist.model.js';
import { WAITLIST_OFFER_STATUS } from './waitlistOffer.model.js';
import { waitlistRepository } from './waitlist.repository.js';

const OFFER_TTL_MS = 30 * 60 * 1000;

export const toPublicWaitlist = (w) => ({
  id: String(w._id),
  patientId: String(w.patientId),
  doctorId: String(w.doctorId),
  clinicId: w.clinicId ? String(w.clinicId) : null,
  appointmentTypeId: String(w.appointmentTypeId),
  preferredDate: w.preferredDate,
  preferredTimeRange: w.preferredTimeRange,
  timezone: w.timezone,
  consultationMode: w.consultationMode,
  status: w.status,
  createdAt: w.createdAt,
});

export const toPublicOffer = (o) => ({
  id: String(o._id),
  waitlistId: String(o.waitlistId),
  patientId: String(o.patientId),
  doctorId: String(o.doctorId),
  appointmentTypeId: String(o.appointmentTypeId),
  offeredStartAt: o.offeredStartAt,
  timezone: o.timezone,
  status: o.status,
  expiresAt: o.expiresAt,
  appointmentId: o.appointmentId ? String(o.appointmentId) : null,
});

export const joinWaitlist = async (user, input) => {
  const doctor = await doctorRepository.findById(input.doctorId);
  if (!doctor || !doctor.isVerified || doctor.profileStatus !== 'PUBLISHED') {
    throw new ApiError(404, 'Approved published doctor not found', 'DOCTOR_NOT_FOUND');
  }
  const apptType = await calendlyRepository.findAppointmentTypeById(input.appointmentTypeId);
  if (!apptType || String(apptType.doctorId) !== String(doctor._id) || !apptType.isActive) {
    throw new ApiError(404, 'Active appointment type not found', 'APPOINTMENT_TYPE_NOT_FOUND');
  }

  const created = await waitlistRepository.create({
    patientId: user._id,
    doctorId: doctor._id,
    clinicId: doctor.primaryClinicId ?? null,
    appointmentTypeId: apptType._id,
    preferredDate: input.preferredDate,
    preferredTimeRange: input.preferredTimeRange ?? { start: '00:00', end: '23:59' },
    timezone: input.timezone,
    consultationMode: apptType.consultationMode ?? 'IN_PERSON',
    status: WAITLIST_STATUS.ACTIVE,
  });

  return toPublicWaitlist(created);
};

export const listMyWaitlist = async (user) => {
  const items = await waitlistRepository.listByPatient(user._id);
  return items.map(toPublicWaitlist);
};

export const leaveWaitlist = async (user, id) => {
  const existing = await waitlistRepository.findById(id);
  if (!existing) throw new ApiError(404, 'Waitlist entry not found', 'WAITLIST_NOT_FOUND');
  if (String(existing.patientId) !== String(user._id)) {
    throw new ApiError(403, 'You can only cancel your own waitlist entry', 'FORBIDDEN');
  }
  const updated = await waitlistRepository.updateById(id, { status: WAITLIST_STATUS.CANCELLED });
  return toPublicWaitlist(updated);
};

export const processWaitlistForCancelledAppointment = async (cancelledAppointment) => {
  try {
    if (!cancelledAppointment?.doctorId || !cancelledAppointment?.appointmentTypeId) return null;
    const candidates = await waitlistRepository.findEligibleActive(
      cancelledAppointment.doctorId,
      cancelledAppointment.appointmentTypeId
    );
    if (candidates.length === 0) return null;

    const first = candidates[0];
    const startDate = new Date(cancelledAppointment.startAt);
    startDate.setUTCHours(0, 0, 0, 0);
    const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);

    // Always re-query Calendly availability; never assume cancelled slot is open.
    const availability = await getDoctorAvailability(cancelledAppointment.doctorId, {
      appointmentTypeId: String(cancelledAppointment.appointmentTypeId),
      startDate,
      endDate,
      timezone: first.timezone ?? 'UTC',
    });

    const availableSlot = availability.availableSlots?.[0];
    if (!availableSlot) return null;

    const offer = await waitlistRepository.createOffer({
      waitlistId: first._id,
      patientId: first.patientId,
      doctorId: first.doctorId,
      appointmentTypeId: first.appointmentTypeId,
      offeredStartAt: new Date(availableSlot.startTime),
      timezone: first.timezone ?? 'UTC',
      status: WAITLIST_OFFER_STATUS.PENDING,
      expiresAt: new Date(Date.now() + OFFER_TTL_MS),
    });

    await waitlistRepository.updateById(first._id, { status: WAITLIST_STATUS.OFFERED });

    // Notify patient via existing notification repository (in-app + consented SMS).
    await notificationRepository.create({
      userId: first.patientId,
      appointmentId: cancelledAppointment._id,
      idempotencyKey: `waitlist-offer:${offer._id}:IN_APP`,
      eventType: NOTIFICATION_EVENT_TYPES.APPOINTMENT_CONFIRMED,
      channel: NOTIFICATION_CHANNELS.IN_APP,
      provider: NOTIFICATION_PROVIDERS.INTERNAL,
      title: 'Appointment Slot Available (Waitlist Offer)',
      messageBody: `A slot on ${availableSlot.displayTime} is now available. Accept your waitlist offer before it expires.`,
      status: NOTIFICATION_STATUS.SENT,
      scheduledAt: new Date(),
      sentAt: new Date(),
    });

    return toPublicOffer(offer);
  } catch (err) {
    console.error('[waitlist] Offer creation failed:', err?.message);
    return null;
  }
};

export const getWaitlistOffer = async (user, offerId) => {
  const offer = await waitlistRepository.findOfferById(offerId);
  if (!offer) throw new ApiError(404, 'Waitlist offer not found', 'OFFER_NOT_FOUND');
  if (String(offer.patientId) !== String(user._id)) {
    throw new ApiError(403, 'You are not authorized to view this offer', 'FORBIDDEN');
  }
  return toPublicOffer(offer);
};

export const acceptWaitlistOffer = async (user, offerId) => {
  const offer = await waitlistRepository.findOfferById(offerId);
  if (!offer) throw new ApiError(404, 'Waitlist offer not found', 'OFFER_NOT_FOUND');
  if (String(offer.patientId) !== String(user._id)) {
    throw new ApiError(403, 'You are not authorized to accept this offer', 'FORBIDDEN');
  }
  if (offer.status !== WAITLIST_OFFER_STATUS.PENDING) {
    throw new ApiError(409, `Offer is already ${offer.status}`, 'OFFER_NOT_PENDING');
  }
  if (new Date(offer.expiresAt) <= new Date()) {
    await waitlistRepository.updateOfferById(offer._id, { status: WAITLIST_OFFER_STATUS.EXPIRED });
    await waitlistRepository.updateById(offer.waitlistId, { status: WAITLIST_STATUS.EXPIRED });
    throw new ApiError(410, 'Waitlist offer has expired', 'OFFER_EXPIRED');
  }

  // Revalidate live Calendly availability before booking.
  const slotStart = new Date(offer.offeredStartAt);
  const avail = await getDoctorAvailability(offer.doctorId, {
    appointmentTypeId: String(offer.appointmentTypeId),
    startDate: new Date(slotStart.getTime() - 60_000),
    endDate: new Date(slotStart.getTime() + 60_000),
    timezone: offer.timezone ?? 'UTC',
  });

  const stillAvailable = avail.availableSlots?.some(
    (s) => new Date(s.startTime).getTime() === slotStart.getTime()
  );
  if (!stillAvailable) {
    throw new ApiError(409, 'Offered slot is no longer available on Calendly', 'SLOT_UNAVAILABLE');
  }

  const claimed = await waitlistRepository.claimPendingOffer(offer._id, user._id, new Date());
  if (!claimed) {
    throw new ApiError(409, 'Offer was already claimed or expired', 'OFFER_CONFLICT');
  }

  const { appointment } = await bookAppointment(
    user,
    {
      doctorId: String(offer.doctorId),
      appointmentTypeId: String(offer.appointmentTypeId),
      startTime: slotStart,
      timezone: offer.timezone ?? 'UTC',
    },
    `waitlist-offer-${offer._id}`
  );

  await waitlistRepository.updateOfferById(offer._id, { appointmentId: appointment.id });
  await waitlistRepository.updateById(offer.waitlistId, { status: WAITLIST_STATUS.BOOKED });

  return { offer: toPublicOffer({ ...claimed, appointmentId: appointment.id }), appointment };
};

export const declineWaitlistOffer = async (user, offerId) => {
  const offer = await waitlistRepository.findOfferById(offerId);
  if (!offer) throw new ApiError(404, 'Waitlist offer not found', 'OFFER_NOT_FOUND');
  if (String(offer.patientId) !== String(user._id)) {
    throw new ApiError(403, 'You are not authorized to decline this offer', 'FORBIDDEN');
  }
  const updated = await waitlistRepository.updateOfferById(offer._id, { status: WAITLIST_OFFER_STATUS.DECLINED });
  await waitlistRepository.updateById(offer.waitlistId, { status: WAITLIST_STATUS.ACTIVE });
  return toPublicOffer(updated);
};
