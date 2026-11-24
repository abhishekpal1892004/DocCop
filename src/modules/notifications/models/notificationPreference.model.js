import mongoose from 'mongoose';
import { E164_REGEX } from '../../patients/patient.constants.js';
import { PREFERRED_CHANNELS } from '../notification.constants.js';

const channelConsentSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    optedIn: { type: Boolean, default: false },
    consentSource: { type: String, trim: true, maxlength: 100 },
    consentVersion: { type: String, trim: true, maxlength: 32 },
    consentAt: { type: Date, default: null },
    optedOutAt: { type: Date, default: null },
  },
  { _id: false }
);

const notificationPreferenceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      immutable: true,
    },
    phoneNumber: {
      type: String,
      trim: true,
      match: [E164_REGEX, 'Phone number must be in E.164 format'],
    },
    preferredChannel: {
      type: String,
      enum: PREFERRED_CHANNELS,
      default: 'SMS',
    },
    sms: { type: channelConsentSchema, default: () => ({}) },
    whatsapp: { type: channelConsentSchema, default: () => ({}) },
    inApp: {
      enabled: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

export const NotificationPreference =
  mongoose.models.NotificationPreference ??
  mongoose.model('NotificationPreference', notificationPreferenceSchema);
