import { Clinic } from './clinic.model.js';
import { DoctorClinicAssociation } from './doctorClinicAssociation.model.js';

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const clinicRepository = {
  findById: (id) => Clinic.findById(id).lean(),

  findByOrganizationId: (organizationId) =>
    Clinic.find({ organizationId }).sort({ createdAt: -1 }).lean(),

  async create(data) {
    const doc = await Clinic.create(data);
    return doc.toObject();
  },

  findMatchingClinic: ({ clinicName, city, registrationNumber }) => {
    const filter = {};
    if (registrationNumber) {
      filter.registrationNumber = registrationNumber;
    } else {
      filter.clinicName = new RegExp(`^${escapeRegex(clinicName)}$`, 'i');
      if (city) filter['address.city'] = new RegExp(`^${escapeRegex(city)}$`, 'i');
    }
    return Clinic.findOne(filter).lean();
  },

  async list({ verificationStatus, city, state, q, page = 1, limit = 20 }) {
    const filter = {};
    if (verificationStatus) filter.verificationStatus = verificationStatus;
    if (city) filter['address.city'] = new RegExp(`^${escapeRegex(city)}$`, 'i');
    if (state) filter['address.state'] = new RegExp(`^${escapeRegex(state)}$`, 'i');
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ clinicName: rx }, { registrationNumber: rx }, { 'address.city': rx }];
    }
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      Clinic.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      Clinic.countDocuments(filter),
    ]);
    return { items, total, page, limit };
  },

  updateVerification: (id, set) =>
    Clinic.findByIdAndUpdate(id, { $set: set }, { new: true, runValidators: true }).lean(),

  countAll: () => Clinic.countDocuments(),
  countByStatus: (verificationStatus) => Clinic.countDocuments({ verificationStatus }),

  // Doctor-Clinic associations
  upsertAssociation: ({ doctorUserId, clinicId, applicationId, doctorProfileId, relationshipType, affiliationDocumentId, verificationStatus }) =>
    DoctorClinicAssociation.findOneAndUpdate(
      { doctorUserId, clinicId },
      {
        $set: {
          relationshipType,
          ...(applicationId ? { applicationId } : {}),
          ...(doctorProfileId ? { doctorProfileId } : {}),
          ...(affiliationDocumentId !== undefined ? { affiliationDocumentId } : {}),
          ...(verificationStatus ? { verificationStatus } : {}),
        },
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean(),

  findAssociationById: (id) => DoctorClinicAssociation.findById(id).lean(),

  findAssociationsByDoctorUserId: (doctorUserId) =>
    DoctorClinicAssociation.find({ doctorUserId }).sort({ createdAt: -1 }).lean(),

  findAssociationsByClinicId: (clinicId) =>
    DoctorClinicAssociation.find({ clinicId }).sort({ createdAt: -1 }).lean(),

  updateAssociationVerification: (id, set) =>
    DoctorClinicAssociation.findByIdAndUpdate(id, { $set: set }, { new: true, runValidators: true }).lean(),

  linkDoctorProfileToAssociations: (doctorUserId, doctorProfileId, { session } = {}) =>
    DoctorClinicAssociation.updateMany(
      { doctorUserId },
      { $set: { doctorProfileId } },
      session ? { session } : undefined
    ),
};
