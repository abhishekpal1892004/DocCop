import { PAYMENT_STATUS } from './payment.constants.js';
import { Payment } from './payment.model.js';
import { RazorpayWebhookEvent } from './razorpayWebhook.model.js';

export const paymentRepository = {
  async create(data) {
    const doc = await Payment.create(data);
    return doc.toObject();
  },

  findById: (id) => Payment.findById(id).lean(),

  findByOrderId: (razorpayOrderId) => Payment.findOne({ razorpayOrderId }).lean(),

  findByPaymentId: (razorpayPaymentId) => Payment.findOne({ razorpayPaymentId }).lean(),

  findActiveOrderForAppointment: (appointmentId) =>
    Payment.findOne({
      appointmentId,
      status: { $in: [PAYMENT_STATUS.CREATED, PAYMENT_STATUS.PENDING, PAYMENT_STATUS.AUTHORIZED, PAYMENT_STATUS.CAPTURED] },
    }).lean(),

  updateById: (id, set) =>
    Payment.findByIdAndUpdate(id, { $set: set }, { new: true, runValidators: true }).lean(),

  async listByPatient(patientId, { page = 1, limit = 20 }) {
    const filter = { patientId };
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      Payment.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      Payment.countDocuments(filter),
    ]);
    return { items, total, page, limit };
  },

  // Webhook dedup
  findWebhookByEventId: (eventId) => RazorpayWebhookEvent.findOne({ eventId }).lean(),

  async createWebhookEvent(data) {
    const doc = await RazorpayWebhookEvent.create(data);
    return doc.toObject();
  },

  updateWebhookById: (id, set) =>
    RazorpayWebhookEvent.findByIdAndUpdate(id, { $set: set }, { new: true }).lean(),
};
