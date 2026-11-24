import mongoose from 'mongoose';
import { GENDERS, E164_REGEX } from './patient.constants.js';

const addressSchema = new mongoose.Schema(
  {
    street: { type: String, trim: true, maxlength: 200 },
    city: { type: String, trim: true, maxlength: 100 },
    state: { type: String, trim: true, maxlength: 100 },
    country: { type: String, trim: true, maxlength: 100 },
    pincode: { type: String, trim: true, maxlength: 10 },
  },
  { _id: false }
);

const patientProfileSchema = new mongoose.Schema(
  {
    // Ownership always comes from the authenticated MongoDB user, never from the request.
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, immutable: true },

    dateOfBirth: Date,
    gender: { type: String, enum: GENDERS },
    phoneNumber: { type: String, trim: true, match: [E164_REGEX, 'Phone number must be in E.164 format'] },
    address: { type: addressSchema, default: undefined },
    emergencyContact: {
      type: new mongoose.Schema(
        {
          name: { type: String, trim: true, maxlength: 100 },
          relationship: { type: String, trim: true, maxlength: 50 },
          phoneNumber: { type: String, trim: true, match: [E164_REGEX, 'Phone number must be in E.164 format'] },
        },
        { _id: false }
      ),
      default: undefined,
    },

    profileCompleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const PatientProfile = mongoose.models.PatientProfile ?? mongoose.model('PatientProfile', patientProfileSchema);
