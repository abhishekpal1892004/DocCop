import { NmcLookup } from './nmcLookup.model.js';

export const nmcLookupRepository = {
  async create(data) {
    const doc = await NmcLookup.create(data);
    return doc.toObject();
  },

  /** Mark all active lookups of an application as superseded. */
  supersedeForApplication: (applicationId, at) =>
    NmcLookup.updateMany({ applicationId, supersededAt: { $exists: false } }, { $set: { supersededAt: at } }),

  /** Lookups started recently, for per-application attempt counting. */
  countSince: (applicationId, since) => NmcLookup.countDocuments({ applicationId, checkedAt: { $gte: since } }),

  findByApplicationId: (applicationId) => NmcLookup.find({ applicationId }).sort({ checkedAt: -1 }).limit(10).lean(),
};
