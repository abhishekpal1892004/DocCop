import { ApiError } from '../../../utils/ApiError.js';
import { appointmentRepository } from '../../appointments/appointment.repository.js';
import { AUDIT_ACTIONS, AUDIT_TARGET_TYPES } from '../../auditLogs/auditLog.constants.js';
import { recordAuditEvent } from '../../auditLogs/auditLog.service.js';
import { requireApprovedDoctorForUser } from '../../calendly/calendly.service.js';
import { clinicRepository } from '../../clinics/clinic.repository.js';
import { doctorRepository } from '../../doctors/doctor.repository.js';
import { ROLES } from '../../users/user.constants.js';
import { userRepository } from '../../users/user.repository.js';
import { PRESCRIPTION_STATUS } from '../prescription.constants.js';
import { prescriptionRepository } from '../prescription.repository.js';
import { generatePrescriptionPdfBuffer } from './prescriptionPdf.service.js';
import { assertDoctorEligibleForAppointment } from './prescriptionValidation.service.js';

export const toPublicPrescription = (p) => ({
  id: String(p._id),
  prescriptionNumber: p.prescriptionNumber ?? null,
  patientId: String(p.patientId),
  doctorId: String(p.doctorId),
  appointmentId: String(p.appointmentId),
  clinicId: p.clinicId ? String(p.clinicId) : null,
  diagnosis: p.diagnosis ?? null,
  clinicalNotes: p.clinicalNotes ?? null,
  medicines: p.medicines ?? [],
  generalInstructions: p.generalInstructions ?? null,
  status: p.status,
  issuedAt: p.issuedAt ?? null,
  previousPrescriptionId: p.previousPrescriptionId ? String(p.previousPrescriptionId) : null,
  amendmentReason: p.amendmentReason ?? null,
  voidReason: p.voidReason ?? null,
  voidedAt: p.voidedAt ?? null,
  version: p.version ?? 1,
  doctorAttestation: p.doctorAttestation ?? null,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
});

const assertCanViewPrescription = async (user, prescription, requestId) => {
  if (user.role === ROLES.PATIENT && String(prescription.patientId) === String(user._id)) {
    if (prescription.status === PRESCRIPTION_STATUS.DRAFT) {
      throw new ApiError(404, 'Prescription not found', 'PRESCRIPTION_NOT_FOUND');
    }
    return;
  }
  if (user.role === ROLES.DOCTOR) {
    const doctor = await doctorRepository.findByUserId(user._id);
    if (doctor && String(prescription.doctorId) === String(doctor._id)) return;
  }

  await recordAuditEvent({
    actorUserId: user._id,
    actorRole: user.role,
    action: AUDIT_ACTIONS.FAILED_AUTHORIZATION_ATTEMPT,
    targetType: AUDIT_TARGET_TYPES.PRESCRIPTION,
    targetId: prescription._id,
    outcome: 'DENIED',
    requestId,
    remarks: 'Unauthorized attempt to view prescription',
  });
  throw new ApiError(403, 'You are not authorized to access this prescription', 'FORBIDDEN');
};

export const createPrescriptionDraft = async (user, input, requestId) => {
  const { doctor, appointment } = await assertDoctorEligibleForAppointment(user, input.appointmentId);

  const created = await prescriptionRepository.create({
    patientId: appointment.patientId,
    doctorId: doctor._id,
    appointmentId: appointment._id,
    clinicId: appointment.clinicId ?? doctor.primaryClinicId ?? null,
    diagnosis: input.diagnosis,
    clinicalNotes: input.clinicalNotes,
    medicines: input.medicines,
    generalInstructions: input.generalInstructions,
    status: PRESCRIPTION_STATUS.DRAFT,
    version: 1,
  });

  await recordAuditEvent({
    actorUserId: user._id,
    actorRole: user.role,
    action: AUDIT_ACTIONS.PRESCRIPTION_CREATED,
    targetType: AUDIT_TARGET_TYPES.PRESCRIPTION,
    targetId: created._id,
    newStatus: PRESCRIPTION_STATUS.DRAFT,
    requestId,
  });

  return toPublicPrescription(created);
};

export const updatePrescriptionDraft = async (user, id, input) => {
  const doctor = await requireApprovedDoctorForUser(user);
  const existing = await prescriptionRepository.findById(id);
  if (!existing) throw new ApiError(404, 'Prescription not found', 'PRESCRIPTION_NOT_FOUND');
  if (String(existing.doctorId) !== String(doctor._id)) {
    throw new ApiError(403, 'You can only edit your own prescriptions', 'FORBIDDEN');
  }
  if (existing.status !== PRESCRIPTION_STATUS.DRAFT) {
    throw new ApiError(
      409,
      'Issued prescriptions are immutable; create an amendment instead',
      'PRESCRIPTION_IMMUTABLE'
    );
  }

  const updated = await prescriptionRepository.updateDraftById(id, doctor._id, input);
  if (!updated) throw new ApiError(409, 'Prescription can no longer be edited', 'PRESCRIPTION_IMMUTABLE');
  return toPublicPrescription(updated);
};

export const issuePrescription = async (user, id, requestId) => {
  const doctor = await requireApprovedDoctorForUser(user);
  const existing = await prescriptionRepository.findById(id);
  if (!existing) throw new ApiError(404, 'Prescription not found', 'PRESCRIPTION_NOT_FOUND');
  if (String(existing.doctorId) !== String(doctor._id)) {
    throw new ApiError(403, 'You can only issue your own prescriptions', 'FORBIDDEN');
  }
  if (existing.status !== PRESCRIPTION_STATUS.DRAFT) {
    throw new ApiError(409, `Cannot issue a prescription in ${existing.status} status`, 'INVALID_PRESCRIPTION_STATUS');
  }
  if (!existing.medicines || existing.medicines.length === 0) {
    throw new ApiError(422, 'At least one medicine is required before issuing a prescription', 'MEDICINES_REQUIRED');
  }

  const now = new Date();
  const prescriptionNumber = await prescriptionRepository.nextPrescriptionNumber(now.getUTCFullYear());
  const updated = await prescriptionRepository.transitionStatusById(
    id,
    doctor._id,
    [PRESCRIPTION_STATUS.DRAFT],
    {
      prescriptionNumber,
      status: PRESCRIPTION_STATUS.ISSUED,
      issuedAt: now,
      issuedBy: user._id,
      doctorAttestation: {
        doctorName: doctor.personalDetails?.fullName ?? user.fullName,
        qualification: doctor.professionalDetails?.qualification,
        registrationNumberReference: doctor.medicalRegistration?.registrationNumber,
        attestedAt: now,
      },
    }
  );
  if (!updated) {
    throw new ApiError(409, 'Prescription state changed concurrently', 'INVALID_PRESCRIPTION_STATUS');
  }

  await recordAuditEvent({
    actorUserId: user._id,
    actorRole: user.role,
    action: AUDIT_ACTIONS.PRESCRIPTION_ISSUED,
    targetType: AUDIT_TARGET_TYPES.PRESCRIPTION,
    targetId: updated._id,
    previousStatus: PRESCRIPTION_STATUS.DRAFT,
    newStatus: PRESCRIPTION_STATUS.ISSUED,
    requestId,
    metadata: { prescriptionNumber },
  });

  return toPublicPrescription(updated);
};

export const amendPrescription = async (user, id, input, requestId) => {
  const doctor = await requireApprovedDoctorForUser(user);
  const existing = await prescriptionRepository.findById(id);
  if (!existing) throw new ApiError(404, 'Prescription not found', 'PRESCRIPTION_NOT_FOUND');
  if (String(existing.doctorId) !== String(doctor._id)) {
    throw new ApiError(403, 'You can only amend your own prescriptions', 'FORBIDDEN');
  }
  if (existing.status !== PRESCRIPTION_STATUS.ISSUED) {
    throw new ApiError(409, 'Only ISSUED prescriptions can be amended', 'INVALID_PRESCRIPTION_STATUS');
  }

  const now = new Date();
  const markedAmended = await prescriptionRepository.transitionStatusById(
    id,
    doctor._id,
    [PRESCRIPTION_STATUS.ISSUED],
    { status: PRESCRIPTION_STATUS.AMENDED }
  );
  if (!markedAmended) {
    throw new ApiError(409, 'Prescription state changed concurrently', 'INVALID_PRESCRIPTION_STATUS');
  }

  const prescriptionNumber = await prescriptionRepository.nextPrescriptionNumber(now.getUTCFullYear());
  const amended = await prescriptionRepository.create({
    prescriptionNumber,
    patientId: existing.patientId,
    doctorId: doctor._id,
    appointmentId: existing.appointmentId,
    clinicId: existing.clinicId,
    diagnosis: input.diagnosis ?? existing.diagnosis,
    clinicalNotes: input.clinicalNotes ?? existing.clinicalNotes,
    medicines: input.medicines ?? existing.medicines,
    generalInstructions: input.generalInstructions ?? existing.generalInstructions,
    status: PRESCRIPTION_STATUS.ISSUED,
    issuedAt: now,
    issuedBy: user._id,
    previousPrescriptionId: existing._id,
    amendmentReason: input.reason,
    version: (existing.version ?? 1) + 1,
    doctorAttestation: {
      doctorName: doctor.personalDetails?.fullName ?? user.fullName,
      qualification: doctor.professionalDetails?.qualification,
      registrationNumberReference: doctor.medicalRegistration?.registrationNumber,
      attestedAt: now,
    },
  });

  await recordAuditEvent({
    actorUserId: user._id,
    actorRole: user.role,
    action: AUDIT_ACTIONS.PRESCRIPTION_AMENDED,
    targetType: AUDIT_TARGET_TYPES.PRESCRIPTION,
    targetId: amended._id,
    previousStatus: PRESCRIPTION_STATUS.ISSUED,
    newStatus: PRESCRIPTION_STATUS.ISSUED,
    remarks: input.reason,
    requestId,
    metadata: { previousPrescriptionId: String(existing._id), prescriptionNumber },
  });

  return toPublicPrescription(amended);
};

export const voidPrescription = async (user, id, { reason }, requestId) => {
  const doctor = await requireApprovedDoctorForUser(user);
  const existing = await prescriptionRepository.findById(id);
  if (!existing) throw new ApiError(404, 'Prescription not found', 'PRESCRIPTION_NOT_FOUND');
  if (String(existing.doctorId) !== String(doctor._id)) {
    throw new ApiError(403, 'You can only void your own prescriptions', 'FORBIDDEN');
  }
  if (existing.status !== PRESCRIPTION_STATUS.ISSUED) {
    throw new ApiError(409, 'Only ISSUED prescriptions can be voided', 'INVALID_PRESCRIPTION_STATUS');
  }

  const updated = await prescriptionRepository.transitionStatusById(
    id,
    doctor._id,
    [PRESCRIPTION_STATUS.ISSUED],
    {
      status: PRESCRIPTION_STATUS.VOIDED,
      voidReason: reason,
      voidedAt: new Date(),
    }
  );
  if (!updated) {
    throw new ApiError(409, 'Prescription state changed concurrently', 'INVALID_PRESCRIPTION_STATUS');
  }

  await recordAuditEvent({
    actorUserId: user._id,
    actorRole: user.role,
    action: AUDIT_ACTIONS.PRESCRIPTION_VOIDED,
    targetType: AUDIT_TARGET_TYPES.PRESCRIPTION,
    targetId: updated._id,
    previousStatus: PRESCRIPTION_STATUS.ISSUED,
    newStatus: PRESCRIPTION_STATUS.VOIDED,
    remarks: reason,
    requestId,
  });

  return toPublicPrescription(updated);
};

export const getPrescriptionById = async (user, id, requestId) => {
  const prescription = await prescriptionRepository.findById(id);
  if (!prescription) throw new ApiError(404, 'Prescription not found', 'PRESCRIPTION_NOT_FOUND');
  await assertCanViewPrescription(user, prescription, requestId);
  return toPublicPrescription(prescription);
};

export const listPatientPrescriptions = async (user, query) => {
  const result = await prescriptionRepository.listByPatient(user._id, query);
  return {
    prescriptions: result.items.map(toPublicPrescription),
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / result.limit) || 0,
    },
  };
};

export const listDoctorPrescriptions = async (user, query) => {
  const doctor = await requireApprovedDoctorForUser(user);
  const result = await prescriptionRepository.listByDoctor(doctor._id, query);
  return {
    prescriptions: result.items.map(toPublicPrescription),
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / result.limit) || 0,
    },
  };
};

export const downloadPrescriptionPdf = async (user, id, requestId) => {
  const prescription = await prescriptionRepository.findById(id);
  if (!prescription) throw new ApiError(404, 'Prescription not found', 'PRESCRIPTION_NOT_FOUND');
  await assertCanViewPrescription(user, prescription, requestId);
  if (prescription.status === PRESCRIPTION_STATUS.DRAFT) {
    throw new ApiError(409, 'Cannot generate PDF for an unissued draft prescription', 'PRESCRIPTION_NOT_ISSUED');
  }

  const [doctor, patient, clinic, appointment] = await Promise.all([
    doctorRepository.findById(prescription.doctorId),
    userRepository.findById ? userRepository.findById(prescription.patientId) : null,
    prescription.clinicId ? clinicRepository.findById(prescription.clinicId) : null,
    appointmentRepository.findById(prescription.appointmentId),
  ]);

  const buffer = await generatePrescriptionPdfBuffer({
    prescription,
    doctor,
    patient,
    clinic,
    appointment,
  });

  return {
    buffer,
    filename: `${prescription.prescriptionNumber || 'prescription'}.pdf`,
  };
};
