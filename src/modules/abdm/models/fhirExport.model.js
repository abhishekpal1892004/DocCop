import mongoose from 'mongoose';

const fhirExportSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    recordSourceType: { type: String, enum: ['PRESCRIPTION', 'CONSULTATION', 'MEDICAL_RECORD'], required: true },
    sourceRecordId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    exchangeId: { type: mongoose.Schema.Types.ObjectId, ref: 'AbdmExchange', default: null },
    bundleId: { type: String, trim: true, required: true },
    fhirProfileVersion: { type: String, default: 'ndhm.in#6.5.0' },
    validationStatus: { type: String, enum: ['VALID', 'INVALID'], default: 'VALID' },
    exportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

fhirExportSchema.index({ patientId: 1, createdAt: -1 });

export const FhirExport = mongoose.models.FhirExport || mongoose.model('FhirExport', fhirExportSchema);
