import mongoose from 'mongoose';
import { CALENDLY_CONNECTION_STATUS } from './calendly.constants.js';

const calendlyConnectionSchema = new mongoose.Schema(
  {
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
      unique: true,
      immutable: true,
    },
    doctorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      immutable: true,
    },
    calendlyUserUri: { type: String, trim: true, required: true },
    calendlyOrganizationUri: { type: String, trim: true },
    calendlyEmail: { type: String, trim: true, lowercase: true },
    calendlyTimezone: { type: String, trim: true, default: 'UTC' },
    accessTokenEncrypted: { type: String, required: true },
    refreshTokenEncrypted: { type: String },
    tokenExpiresAt: { type: Date },
    grantedScopes: { type: [String], default: [] },
    webhookSubscriptionUri: { type: String, trim: true },
    connectionStatus: {
      type: String,
      enum: Object.values(CALENDLY_CONNECTION_STATUS),
      default: CALENDLY_CONNECTION_STATUS.CONNECTED,
    },
    connectedAt: { type: Date, default: Date.now },
    disconnectedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

calendlyConnectionSchema.index({ calendlyUserUri: 1 });

export const CalendlyConnection =
  mongoose.models.CalendlyConnection ?? mongoose.model('CalendlyConnection', calendlyConnectionSchema);
