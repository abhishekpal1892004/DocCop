import mongoose from 'mongoose';
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EVENT_TYPES,
  NOTIFICATION_PROVIDERS,
  NOTIFICATION_STATUS,
} from '../notification.constants.js';

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true },
    idempotencyKey: { type: String, required: true, unique: true },
    eventType: {
      type: String,
      enum: Object.values(NOTIFICATION_EVENT_TYPES),
      required: true,
    },
    channel: {
      type: String,
      enum: Object.values(NOTIFICATION_CHANNELS),
      required: true,
    },
    provider: {
      type: String,
      enum: Object.values(NOTIFICATION_PROVIDERS),
      required: true,
    },
    recipient: { type: String, trim: true, maxlength: 64 },
    templateKey: { type: String, trim: true, maxlength: 100 },
    contentSid: { type: String, trim: true, maxlength: 100 },
    contentVariables: { type: mongoose.Schema.Types.Mixed, default: {} },
    title: { type: String, trim: true, maxlength: 160 },
    messageBody: { type: String, trim: true, maxlength: 1000 },
    status: {
      type: String,
      enum: Object.values(NOTIFICATION_STATUS),
      default: NOTIFICATION_STATUS.SCHEDULED,
    },
    providerMessageSid: { type: String, trim: true },
    scheduledAt: { type: Date, required: true },
    sentAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    attemptCount: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 3 },
    nextAttemptAt: { type: Date, default: null },
    lockUntil: { type: Date, default: null },
    lastErrorCode: { type: String, trim: true, maxlength: 64 },
    lastErrorMessage: { type: String, trim: true, maxlength: 500 },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ appointmentId: 1, eventType: 1 });
notificationSchema.index({ status: 1, scheduledAt: 1, nextAttemptAt: 1 });
notificationSchema.index({ providerMessageSid: 1 }, { sparse: true });

export const Notification = mongoose.models.Notification ?? mongoose.model('Notification', notificationSchema);
