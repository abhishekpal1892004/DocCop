import mongoose from 'mongoose';
import { AUDIT_ACTIONS, AUDIT_TARGET_TYPES } from './auditLog.constants.js';

const auditLogSchema = new mongoose.Schema(
  {
    actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actorRole: { type: String, trim: true, maxlength: 32 },
    action: { type: String, enum: Object.values(AUDIT_ACTIONS), required: true },
    targetType: { type: String, enum: Object.values(AUDIT_TARGET_TYPES), required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    outcome: { type: String, enum: ['SUCCESS', 'DENIED', 'FAILURE'], default: 'SUCCESS' },
    requestId: { type: String, trim: true, maxlength: 64 },
    previousStatus: { type: String, trim: true, maxlength: 64 },
    newStatus: { type: String, trim: true, maxlength: 64 },
    remarks: { type: String, trim: true, maxlength: 1000 },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

auditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
auditLogSchema.index({ actorUserId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

export const AuditLog = mongoose.models.AuditLog ?? mongoose.model('AuditLog', auditLogSchema);
