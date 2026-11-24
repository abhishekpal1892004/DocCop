import { ApiError } from '../../utils/ApiError.js';
import { APPOINTMENT_STATUS } from '../appointments/appointment.constants.js';
import { appointmentRepository } from '../appointments/appointment.repository.js';
import { AUDIT_ACTIONS, AUDIT_TARGET_TYPES } from '../auditLogs/auditLog.constants.js';
import { recordAuditEvent } from '../auditLogs/auditLog.service.js';
import { doctorRepository } from '../doctors/doctor.repository.js';
import { REVIEW_MODERATION_STATUS } from './review.constants.js';
import { reviewRepository } from './review.repository.js';

export const toPublicReview = (r) => ({
  id: String(r._id),
  patientId: String(r.patientId),
  doctorId: String(r.doctorId),
  appointmentId: String(r.appointmentId),
  rating: r.rating,
  reviewText: r.reviewText ?? '',
  moderationStatus: r.moderationStatus,
  isVerifiedAppointment: Boolean(r.isVerifiedAppointment),
  reportedCount: r.reportedCount ?? 0,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

export const submitDoctorReview = async (user, doctorId, { appointmentId, rating, reviewText }) => {
  const doctor = await doctorRepository.findById(doctorId);
  if (!doctor || !doctor.isVerified) {
    throw new ApiError(404, 'Doctor not found', 'DOCTOR_NOT_FOUND');
  }
  if (String(doctor.userId) === String(user._id)) {
    throw new ApiError(403, 'You cannot review your own doctor profile', 'SELF_REVIEW_FORBIDDEN');
  }

  const appt = await appointmentRepository.findById(appointmentId);
  if (!appt) throw new ApiError(404, 'Appointment not found', 'APPOINTMENT_NOT_FOUND');
  if (String(appt.patientId) !== String(user._id)) {
    throw new ApiError(403, 'You can only review your own appointments', 'FORBIDDEN');
  }
  if (String(appt.doctorId) !== String(doctor._id)) {
    throw new ApiError(400, 'Appointment does not belong to the specified doctor', 'APPOINTMENT_DOCTOR_MISMATCH');
  }
  if (appt.status !== APPOINTMENT_STATUS.COMPLETED) {
    throw new ApiError(409, 'Only completed appointments are eligible for review', 'APPOINTMENT_NOT_COMPLETED');
  }

  const existing = await reviewRepository.findByPatientAndAppointment(user._id, appt._id);
  if (existing) {
    throw new ApiError(409, 'You have already reviewed this appointment', 'REVIEW_ALREADY_EXISTS');
  }

  const created = await reviewRepository.create({
    patientId: user._id,
    doctorId: doctor._id,
    appointmentId: appt._id,
    rating,
    reviewText,
    moderationStatus: REVIEW_MODERATION_STATUS.APPROVED,
    isVerifiedAppointment: true,
  });

  return toPublicReview(created);
};

export const getDoctorReviews = async (doctorId, query) => {
  const [result, ratingSummary] = await Promise.all([
    reviewRepository.listApprovedByDoctor(doctorId, query),
    reviewRepository.getDoctorRatingSummary(doctorId),
  ]);
  return {
    reviews: result.items.map(toPublicReview),
    ratingSummary,
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / result.limit) || 0,
    },
  };
};

export const listMyReviews = async (user, query) => {
  const result = await reviewRepository.listByPatient(user._id, query);
  return {
    reviews: result.items.map(toPublicReview),
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / result.limit) || 0,
    },
  };
};

export const updateMyReview = async (user, id, input) => {
  const existing = await reviewRepository.findById(id);
  if (!existing) throw new ApiError(404, 'Review not found', 'REVIEW_NOT_FOUND');
  if (String(existing.patientId) !== String(user._id)) {
    throw new ApiError(403, 'You can only edit your own review', 'FORBIDDEN');
  }
  const updated = await reviewRepository.updateById(id, input);
  return toPublicReview(updated);
};

export const deleteMyReview = async (user, id) => {
  const existing = await reviewRepository.findById(id);
  if (!existing) throw new ApiError(404, 'Review not found', 'REVIEW_NOT_FOUND');
  if (String(existing.patientId) !== String(user._id)) {
    throw new ApiError(403, 'You can only delete your own review', 'FORBIDDEN');
  }
  await reviewRepository.deleteById(id);
  return { deleted: true, id: String(id) };
};

export const reportReview = async (id) => {
  const updated = await reviewRepository.incrementReportCount(id);
  if (!updated) throw new ApiError(404, 'Review not found', 'REVIEW_NOT_FOUND');
  return toPublicReview(updated);
};

// Admin moderation
export const listReviewsForAdmin = async (query) => {
  const result = await reviewRepository.listForModeration(query);
  return {
    reviews: result.items.map(toPublicReview),
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / result.limit) || 0,
    },
  };
};

export const moderateReviewByAdmin = async (adminUser, id, { moderationStatus, remarks }) => {
  const existing = await reviewRepository.findById(id);
  if (!existing) throw new ApiError(404, 'Review not found', 'REVIEW_NOT_FOUND');

  // Admin can only update moderationStatus & remarks — never alter rating or reviewText.
  const updated = await reviewRepository.updateById(id, {
    moderationStatus,
    moderationRemarks: remarks,
    moderatedBy: adminUser._id,
    moderatedAt: new Date(),
  });

  await recordAuditEvent({
    actorUserId: adminUser._id,
    actorRole: adminUser.role,
    action: AUDIT_ACTIONS.DOCTOR_APPROVED, // reuse or generic admin moderation log
    targetType: AUDIT_TARGET_TYPES.DOCTOR_PROFILE,
    targetId: existing.doctorId,
    previousStatus: existing.moderationStatus,
    newStatus: moderationStatus,
    remarks,
    metadata: { reviewId: String(existing._id) },
  });

  return toPublicReview(updated);
};
