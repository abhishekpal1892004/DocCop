import { ApiError } from '../../utils/ApiError.js';
import { calendlyRepository } from '../calendly/calendly.repository.js';
import {
  requireApprovedDoctorForUser,
  toPublicAppointmentType,
} from '../calendly/calendly.service.js';
import { clinicRepository } from '../clinics/clinic.repository.js';
import { toPublicAssociation, toPublicClinic } from '../clinics/clinic.service.js';
import { doctorApplicationRepository } from '../doctorApplications/doctorApplication.repository.js';
import { doctorRepository } from './doctor.repository.js';

export const toPublicDoctor = (doc) => ({
  id: String(doc._id),
  fullName: doc.personalDetails?.fullName ?? null,
  profileImage: doc.personalDetails?.profileImage ?? null,
  professionalDetails: {
    qualification: doc.professionalDetails?.qualification ?? null,
    specialization: doc.professionalDetails?.specialization ?? null,
    experience: doc.professionalDetails?.experience ?? null,
    medicalSystem: doc.professionalDetails?.medicalSystem ?? null,
    collegeName: doc.professionalDetails?.collegeName ?? null,
  },
  medicalRegistration: {
    councilName: doc.medicalRegistration?.councilName ?? null,
    registrationYear: doc.medicalRegistration?.registrationYear ?? null,
    stateCode: doc.medicalRegistration?.stateCode ?? null,
  },
  clinicDetails: {
    clinicName: doc.clinicDetails?.clinicName ?? null,
    clinicType: doc.clinicDetails?.clinicType ?? null,
    address: doc.clinicDetails?.address ?? {},
  },
  consultationFee: doc.consultationFee ?? null,
  bio: doc.bio ?? null,
  languages: doc.languages ?? [],
  consultationModes: doc.consultationModes ?? ['IN_PERSON'],
  isAcceptingPatients: doc.isAcceptingPatients ?? true,
  isVerified: Boolean(doc.isVerified),
  profileStatus: doc.profileStatus ?? 'PUBLISHED',
  primaryClinicId: doc.primaryClinicId ? String(doc.primaryClinicId) : null,
  approvedAt: doc.approvedAt ?? null,
});

export const toOwnDoctorProfile = (doc) => ({
  ...toPublicDoctor(doc),
  personalDetails: doc.personalDetails ?? {},
  medicalRegistration: doc.medicalRegistration ?? {},
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

export const searchVerifiedDoctors = async (query) => {
  const result = await doctorRepository.search({ ...query, acceptingOnly: true });
  return {
    doctors: result.items.map(toPublicDoctor),
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / result.limit) || 0,
    },
  };
};

export const getVerifiedDoctorById = async (id) => {
  const doctor = await doctorRepository.findById(id);
  if (!doctor || !doctor.isVerified || doctor.profileStatus !== 'PUBLISHED') {
    throw new ApiError(404, 'Verified doctor not found', 'DOCTOR_NOT_FOUND');
  }
  return doctor;
};

export const getVerifiedDoctorDetails = async (id) => {
  const doctor = await getVerifiedDoctorById(id);
  const [appointmentTypes, associations] = await Promise.all([
    calendlyRepository.findAppointmentTypesByDoctorId(doctor._id, { activeOnly: true }),
    clinicRepository.findAssociationsByDoctorUserId(doctor.userId),
  ]);

  const verifiedClinics = [];
  for (const assoc of associations) {
    if (assoc.verificationStatus !== 'VERIFIED') continue;
    const clinic = await clinicRepository.findById(assoc.clinicId);
    if (clinic && clinic.verificationStatus === 'VERIFIED') {
      verifiedClinics.push({
        ...toPublicClinic(clinic),
        relationshipType: assoc.relationshipType,
      });
    }
  }

  return {
    doctor: toPublicDoctor(doctor),
    verifiedClinics,
    appointmentTypes: appointmentTypes.map(toPublicAppointmentType),
  };
};

export const getMyDoctorProfile = async (user) => requireApprovedDoctorForUser(user);

export const updateMyDoctorPractice = async (user, input) => {
  await requireApprovedDoctorForUser(user);
  const updated = await doctorRepository.updatePracticeProfile(user._id, input);
  if (!updated) {
    throw new ApiError(404, 'Verified doctor profile not found', 'DOCTOR_PROFILE_NOT_FOUND');
  }
  return updated;
};

export const getMyDoctorClinics = async (user) => {
  await requireApprovedDoctorForUser(user);
  const associations = await clinicRepository.findAssociationsByDoctorUserId(user._id);
  const items = [];
  for (const assoc of associations) {
    const clinic = await clinicRepository.findById(assoc.clinicId);
    items.push({
      association: toPublicAssociation(assoc),
      clinic: clinic ? toPublicClinic(clinic) : null,
    });
  }
  return items;
};

export const getMyDoctorStatus = async (user) => {
  const [app, doctor] = await Promise.all([
    doctorApplicationRepository.findByUserId(user._id),
    doctorRepository.findByUserId(user._id),
  ]);
  return {
    onboardingStatus: user.onboardingStatus,
    applicationStatus: app?.applicationStatus ?? 'NOT_STARTED',
    profileStatus: doctor?.profileStatus ?? 'DRAFT',
    isVerified: Boolean(doctor?.isVerified),
    approvedAt: doctor?.approvedAt ?? null,
  };
};
