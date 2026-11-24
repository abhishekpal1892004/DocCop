import { auditLogRepository } from './auditLog.repository.js';

export const toPublicAuditLog = (log) => ({
  id: String(log._id),
  actorUserId: String(log.actorUserId),
  action: log.action,
  targetType: log.targetType,
  targetId: String(log.targetId),
  previousStatus: log.previousStatus ?? null,
  newStatus: log.newStatus ?? null,
  remarks: log.remarks ?? null,
  metadata: log.metadata ?? {},
  createdAt: log.createdAt,
});

export const recordAuditEvent = (
  { actorUserId, actorRole, action, targetType, targetId, outcome, requestId, previousStatus, newStatus, remarks, metadata },
  options = {}
) =>
  auditLogRepository.create(
    {
      actorUserId,
      actorRole,
      action,
      targetType,
      targetId,
      outcome: outcome ?? 'SUCCESS',
      requestId,
      previousStatus,
      newStatus,
      remarks,
      metadata: metadata ?? {},
    },
    options
  );

export const listAuditLogs = async (query) => {
  const result = await auditLogRepository.list(query);
  return {
    auditLogs: result.items.map(toPublicAuditLog),
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / result.limit) || 0,
    },
  };
};
