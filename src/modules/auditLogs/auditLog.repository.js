import { AuditLog } from './auditLog.model.js';

/**
 * Append-only audit log repository.
 * No update or delete operations are exposed to application code.
 */
export const auditLogRepository = {
  async create(data, { session } = {}) {
    const [doc] = await AuditLog.create([data], session ? { session } : undefined);
    return doc.toObject();
  },

  async list({ targetType, targetId, action, actorUserId, page = 1, limit = 20 }) {
    const filter = {};
    if (targetType) filter.targetType = targetType;
    if (targetId) filter.targetId = targetId;
    if (action) filter.action = action;
    if (actorUserId) filter.actorUserId = actorUserId;

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(filter),
    ]);
    return { items, total, page, limit };
  },
};
