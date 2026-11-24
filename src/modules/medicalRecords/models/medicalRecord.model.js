import mongoose from 'mongoose';
import {
  RECORD_CATEGORIES,
  RECORD_STATUS,
  RECORD_VISIBILITY,
  SCAN_STATUS,
} from '../medicalRecord.constants.js';

const medicalRecordSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
    title: { type: String, trim: true, required: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    category: { type: String, enum: RECORD_CATEGORIES, required: true },
    file: {
      gridFsFileId: { type: mongoose.Schema.Types.ObjectId, required: true },
      originalName: { type: String, trim: true, required: true, maxlength: 255 },
      mimeType: { type: String, trim: true, required: true },
      fileSize: { type: Number, required: true, min: 1 },
      checksum: { type: String, required: true },
      encryptionKeyVersion: { type: String, required: true },
      iv: { type: String, required: true },
      authTag: { type: String, required: true },
    },
    visibility: {
      type: String,
      enum: Object.values(RECORD_VISIBILITY),
      default: RECORD_VISIBILITY.PRIVATE,
    },
    scanStatus: {
      type: String,
      enum: Object.values(SCAN_STATUS),
      default: SCAN_STATUS.UNSCANNED,
    },
    recordStatus: {
      type: String,
      enum: Object.values(RECORD_STATUS),
      default: RECORD_STATUS.ACTIVE,
    },
    uploadedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

medicalRecordSchema.index({ patientId: 1, recordStatus: 1, createdAt: -1 });
medicalRecordSchema.index({ appointmentId: 1 });
medicalRecordSchema.index({ category: 1 });

export const MedicalRecord =
  mongoose.models.MedicalRecord ?? mongoose.model('MedicalRecord', medicalRecordSchema);
