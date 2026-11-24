import { Doctor } from './doctor.model.js';

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const doctorRepository = {
  findById: (id) => Doctor.findById(id).lean(),

  findByUserId: (userId) => Doctor.findOne({ userId }).lean(),

  upsertFromApplication: (application, approvedBy, approvedAt, { primaryClinicId = null, clinicIds = [], session } = {}) =>
    Doctor.findOneAndUpdate(
      { userId: application.userId },
      {
        $set: {
          applicationId: application._id,
          personalDetails: {
            fullName: application.personalDetails?.fullName,
            phoneNumber: application.personalDetails?.phoneNumber,
            email: application.personalDetails?.email,
            profileImage: application.personalDetails?.profileImage,
          },
          professionalDetails: {
            qualification: application.professionalDetails?.qualification,
            specialization: application.professionalDetails?.specialization,
            experience: application.professionalDetails?.experience,
            medicalSystem: application.professionalDetails?.medicalSystem,
            collegeName: application.professionalDetails?.collegeName,
          },
          medicalRegistration: {
            councilName: application.medicalRegistration?.councilName,
            registrationNumber: application.medicalRegistration?.registrationNumber,
            registrationYear: application.medicalRegistration?.registrationYear,
            stateCode: application.medicalRegistration?.stateCode,
          },
          clinicDetails: {
            clinicName: application.clinicDetails?.clinicName,
            clinicType: application.clinicDetails?.clinicType,
            address: application.clinicDetails?.address,
          },
          primaryClinicId,
          clinicIds,
          professionalVerificationStatus: 'VERIFIED',
          profileStatus: 'PUBLISHED',
          isVerified: true,
          approvedAt,
          approvedBy,
        },
        $setOnInsert: {
          isAcceptingPatients: true,
          languages: [],
        },
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true, ...(session ? { session } : {}) }
    ).lean(),

  updatePracticeProfile: (userId, set) =>
    Doctor.findOneAndUpdate({ userId }, { $set: set }, { new: true, runValidators: true }).lean(),

  updateProfileStatus: (id, set) =>
    Doctor.findByIdAndUpdate(id, { $set: set }, { new: true, runValidators: true }).lean(),

  countByProfileStatus: (profileStatus) =>
    Doctor.countDocuments(profileStatus ? { profileStatus } : {}),

  async listForAdmin({ profileStatus, q, page = 1, limit = 20 }) {
    const filter = {};
    if (profileStatus) filter.profileStatus = profileStatus;
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      filter.$or = [
        { 'personalDetails.fullName': rx },
        { 'professionalDetails.specialization': rx },
        { 'clinicDetails.clinicName': rx },
      ];
    }
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      Doctor.find(filter).sort({ approvedAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      Doctor.countDocuments(filter),
    ]);
    return { items, total, page, limit };
  },

  async search({
    specialization,
    city,
    state,
    clinic,
    medicalSystem,
    minFee,
    maxFee,
    minExperience,
    consultationMode,
    search,
    q,
    sortBy = 'newest',
    acceptingOnly = true,
    page = 1,
    limit = 12,
  }) {
    const filter = { isVerified: true, profileStatus: 'PUBLISHED' };
    if (acceptingOnly) filter.isAcceptingPatients = true;
    if (specialization) filter['professionalDetails.specialization'] = new RegExp(escapeRegex(specialization), 'i');
    if (city) filter['clinicDetails.address.city'] = new RegExp(`^${escapeRegex(city)}$`, 'i');
    if (state) filter['clinicDetails.address.state'] = new RegExp(`^${escapeRegex(state)}$`, 'i');
    if (clinic) filter['clinicDetails.clinicName'] = new RegExp(escapeRegex(clinic), 'i');
    if (medicalSystem) filter['professionalDetails.medicalSystem'] = medicalSystem;
    if (consultationMode) filter.consultationModes = consultationMode;
    if (minExperience !== undefined) filter['professionalDetails.experience'] = { $gte: minExperience };
    if (minFee !== undefined || maxFee !== undefined) {
      filter.consultationFee = {
        ...(minFee !== undefined ? { $gte: minFee } : {}),
        ...(maxFee !== undefined ? { $lte: maxFee } : {}),
      };
    }

    const keyword = search || q;
    if (keyword) {
      const rx = new RegExp(escapeRegex(keyword), 'i');
      filter.$or = [
        { 'personalDetails.fullName': rx },
        { 'professionalDetails.specialization': rx },
        { 'clinicDetails.clinicName': rx },
        { 'clinicDetails.address.city': rx },
      ];
    }

    const sortMap = {
      experience: { 'professionalDetails.experience': -1, approvedAt: -1 },
      fee_asc: { consultationFee: 1, approvedAt: -1 },
      fee_desc: { consultationFee: -1, approvedAt: -1 },
      newest: { approvedAt: -1, _id: -1 },
    };

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      Doctor.find(filter).sort(sortMap[sortBy] ?? sortMap.newest).skip(skip).limit(limit).lean(),
      Doctor.countDocuments(filter),
    ]);
    return { items, total, page, limit };
  },
};
