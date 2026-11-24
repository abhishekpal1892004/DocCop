import { Organization } from './organization.model.js';

export const organizationRepository = {
  async create(data) {
    const doc = await Organization.create(data);
    return doc.toObject();
  },

  findById: (id) => Organization.findById(id).lean(),

  findByOwnerUserId: (ownerUserId) => Organization.findOne({ ownerUserId }).lean(),

  updateByOwnerUserId: (ownerUserId, set) =>
    Organization.findOneAndUpdate({ ownerUserId }, { $set: set }, { new: true, runValidators: true }).lean(),

  updateById: (id, set) =>
    Organization.findByIdAndUpdate(id, { $set: set }, { new: true, runValidators: true }).lean(),
};
