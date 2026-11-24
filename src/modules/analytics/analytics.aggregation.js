import { APPOINTMENT_STATUS } from '../appointments/appointment.constants.js';
import { Appointment } from '../appointments/appointment.model.js';
import { CLINIC_VERIFICATION_STATUS } from '../clinics/clinic.constants.js';
import { Clinic } from '../clinics/clinic.model.js';
import { APPLICATION_STATUS } from '../doctorApplications/doctorApplication.constants.js';
import { DoctorApplication } from '../doctorApplications/doctorApplication.model.js';
import { Doctor } from '../doctors/doctor.model.js';
import { ROLES } from '../users/user.constants.js';
import { User } from '../users/user.model.js';

const dateFormatForGranularity = (granularity) => {
  if (granularity === 'month') return '%Y-%m';
  if (granularity === 'week') return '%G-W%V';
  return '%Y-%m-%d';
};

export const analyticsAggregation = {
  async getOverview() {
    const [
      totalUsers,
      totalPatients,
      totalDoctors,
      verifiedDoctors,
      pendingDoctors,
      rejectedApplications,
      totalClinics,
      verifiedClinics,
      appointmentStatusCounts,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: ROLES.PATIENT }),
      User.countDocuments({ role: ROLES.DOCTOR }),
      Doctor.countDocuments({ isVerified: true, profileStatus: 'PUBLISHED' }),
      DoctorApplication.countDocuments({
        applicationStatus: {
          $in: [
            APPLICATION_STATUS.SUBMITTED,
            APPLICATION_STATUS.UNDER_REVIEW,
            APPLICATION_STATUS.NEEDS_INFORMATION,
          ],
        },
      }),
      DoctorApplication.countDocuments({ applicationStatus: APPLICATION_STATUS.REJECTED }),
      Clinic.countDocuments(),
      Clinic.countDocuments({ verificationStatus: CLINIC_VERIFICATION_STATUS.VERIFIED }),
      Appointment.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ]);

    const apptMap = Object.fromEntries(appointmentStatusCounts.map((r) => [r._id, r.count]));
    const totalAppointments = appointmentStatusCounts.reduce((acc, r) => acc + r.count, 0);

    return {
      totalUsers,
      totalPatients,
      totalDoctors,
      verifiedDoctors,
      pendingDoctors,
      rejectedApplications,
      totalClinics,
      verifiedClinics,
      totalAppointments,
      confirmedAppointments: apptMap[APPOINTMENT_STATUS.CONFIRMED] ?? 0,
      completedAppointments: apptMap[APPOINTMENT_STATUS.COMPLETED] ?? 0,
      cancelledAppointments: apptMap[APPOINTMENT_STATUS.CANCELLED] ?? 0,
      noShowAppointments: apptMap[APPOINTMENT_STATUS.NO_SHOW] ?? 0,
    };
  },

  async getAppointmentAnalytics({ from, to, granularity = 'day', timezone = 'UTC', limit = 20 }) {
    const match = {};
    if (from || to) {
      match.startAt = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
    }
    const format = dateFormatForGranularity(granularity);

    const [trend, byStatus, byDoctor] = await Promise.all([
      Appointment.aggregate([
        { $match: match },
        {
          $group: {
            _id: { $dateToString: { format, date: '$startAt', timezone } },
            total: { $sum: 1 },
            completed: { $sum: { $cond: [{ $eq: ['$status', APPOINTMENT_STATUS.COMPLETED] }, 1, 0] } },
            cancelled: { $sum: { $cond: [{ $eq: ['$status', APPOINTMENT_STATUS.CANCELLED] }, 1, 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Appointment.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      Appointment.aggregate([
        { $match: match },
        { $group: { _id: '$doctorId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: limit },
      ]),
    ]);

    const total = byStatus.reduce((acc, r) => acc + r.count, 0);
    const statusMap = Object.fromEntries(byStatus.map((r) => [r._id, r.count]));
    const completed = statusMap[APPOINTMENT_STATUS.COMPLETED] ?? 0;
    const cancelled = statusMap[APPOINTMENT_STATUS.CANCELLED] ?? 0;

    return {
      timezone,
      granularity,
      total,
      completionRate: total > 0 ? Number(((completed / total) * 100).toFixed(2)) : 0,
      cancellationRate: total > 0 ? Number(((cancelled / total) * 100).toFixed(2)) : 0,
      trend: trend.map((t) => ({ period: t._id, total: t.total, completed: t.completed, cancelled: t.cancelled })),
      byStatus: statusMap,
      topDoctors: byDoctor.map((d) => ({ doctorId: String(d._id), appointmentCount: d.count })),
    };
  },

  async getUserGrowthAnalytics({ from, to, granularity = 'day', timezone = 'UTC' }) {
    const match = {};
    if (from || to) {
      match.createdAt = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
    }
    const format = dateFormatForGranularity(granularity);
    const trend = await User.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            period: { $dateToString: { format, date: '$createdAt', timezone } },
            role: '$role',
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.period': 1 } },
    ]);

    return {
      timezone,
      granularity,
      registrations: trend.map((r) => ({
        period: r._id.period,
        role: r._id.role,
        count: r.count,
      })),
    };
  },

  async getDoctorAnalytics({ limit = 20 }) {
    const [bySpecialization, byCity, byProfileStatus] = await Promise.all([
      Doctor.aggregate([
        { $group: { _id: '$professionalDetails.specialization', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: limit },
      ]),
      Doctor.aggregate([
        { $group: { _id: '$clinicDetails.address.city', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: limit },
      ]),
      Doctor.aggregate([{ $group: { _id: '$profileStatus', count: { $sum: 1 } } }]),
    ]);

    return {
      bySpecialization: bySpecialization.map((s) => ({ specialization: s._id ?? 'Unspecified', count: s.count })),
      byCity: byCity.map((c) => ({ city: c._id ?? 'Unspecified', count: c.count })),
      byProfileStatus: Object.fromEntries(byProfileStatus.map((p) => [p._id ?? 'UNKNOWN', p.count])),
    };
  },

  async getClinicAnalytics({ limit = 20 }) {
    const [byStatus, byCity] = await Promise.all([
      Clinic.aggregate([{ $group: { _id: '$verificationStatus', count: { $sum: 1 } } }]),
      Clinic.aggregate([
        { $group: { _id: '$address.city', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: limit },
      ]),
    ]);

    return {
      byVerificationStatus: Object.fromEntries(byStatus.map((s) => [s._id ?? 'UNKNOWN', s.count])),
      byCity: byCity.map((c) => ({ city: c._id ?? 'Unspecified', count: c.count })),
    };
  },
};
