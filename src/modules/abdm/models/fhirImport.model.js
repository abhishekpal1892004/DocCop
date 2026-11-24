import mongoose from 'mongoose';

const fhirImportSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    exchangeId: { type: mongoose.Schema.Types.ObjectId, ref: 'AbdmExchange', required: true },
    consentReference: { type: String, trim: true, required: true },
    externalBundleId: { type: String, trim: true, required: true },
    sourceHipId: { type: String, trim: true, default: 'EXTERNAL_HIP' },
    resourceSummary: { type: mongoose.Schema.Types.Mixed, default: {} },
    validationStatus: { type: String, enum: ['VALID', 'INVALID'], default: 'VALID' },
    isExternal: { type: Boolean, default: true, immutable: true },
    importedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

fhirImportSchema.index({ patientId: 1, externalBundleId: 1 }, { unique: true });

export const FhirImport = mongoose.models.FhirImport || mongoose.model('FhirImport', fhirImportSchema);
