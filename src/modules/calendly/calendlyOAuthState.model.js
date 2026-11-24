import mongoose from 'mongoose';

const calendlyOAuthStateSchema = new mongoose.Schema(
  {
    state: { type: String, required: true, unique: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    doctorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    codeVerifier: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

calendlyOAuthStateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const CalendlyOAuthState =
  mongoose.models.CalendlyOAuthState ?? mongoose.model('CalendlyOAuthState', calendlyOAuthStateSchema);
