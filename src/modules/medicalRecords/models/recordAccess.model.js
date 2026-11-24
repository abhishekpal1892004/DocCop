import mongoose from 'mongoose';

const recordAccessSchema = new mongoose.Schema(
  {
    recordId: { type: mongoose.Schema.Types.ObjectId, ref: 'MedicalRecord', required: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    doctorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    grantedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['ACTIVE', 'REVOKED'], default: 'ACTIVE' },
    grantedAt: { type: Date, default: Date.now },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

recordAccessSchema.index({ recordId: 1, doctorId: 1 }, { unique: true });
recordAccessSchema.index({ doctorUserId: 1, status: 1 });

export const RecordAccess = mongoose.models.RecordAccess ?? mongoose.model('RecordAccess', recordAccessSchema);
