import mongoose from 'mongoose';

const prescriptionSequenceSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

export const PrescriptionSequence =
  mongoose.models.PrescriptionSequence ??
  mongoose.model('PrescriptionSequence', prescriptionSequenceSchema);
