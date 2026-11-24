import mongoose from 'mongoose';
import { ROLES, ACCOUNT_STATUS, ONBOARDING_STATUS } from './user.constants.js';

const userSchema = new mongoose.Schema(
  {
    // Clerk owns authentication; this is the only link to the Clerk identity.
    clerkUserId: { type: String, required: true, unique: true, trim: true, immutable: true },

    firstName: { type: String, trim: true, maxlength: 50 },
    lastName: { type: String, trim: true, maxlength: 50 },
    fullName: { type: String, trim: true, maxlength: 101 },

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email address'],
    },

    profileImage: { type: String, trim: true, maxlength: 2048 },
    phoneNumber: { type: String, trim: true, match: [/^\+[1-9]\d{6,14}$/, 'Phone number must be in E.164 format'] },

    // Role and status are controlled by backend services only (never by request bodies).
    role: { type: String, enum: Object.values(ROLES), required: true },
    accountStatus: { type: String, enum: Object.values(ACCOUNT_STATUS), default: ACCOUNT_STATUS.ACTIVE },
    onboardingStatus: { type: String, enum: Object.values(ONBOARDING_STATUS), default: ONBOARDING_STATUS.NOT_STARTED },

    isEmailVerified: { type: Boolean, default: false },

    preferences: {
      language: { type: String, trim: true, maxlength: 10, default: 'en' },
      timezone: { type: String, trim: true, maxlength: 64 },
    },

    lastLoginAt: Date,

    // Sync bookkeeping (never exposed via the API).
    clerkUpdatedAt: Date, // Clerk's updated_at of the last applied identity sync (ordering guard)
    deletedAt: Date, // set when the Clerk user was deleted (soft delete)
  },
  { timestamps: true }
);

// clerkUserId unique index comes from `unique: true`.
userSchema.index({ email: 1 }); // lookups / future admin search (not unique: Clerk is the authority)
userSchema.index({ role: 1, accountStatus: 1 }); // future admin user listings

export const User = mongoose.models.User ?? mongoose.model('User', userSchema);
