import { CalendlyWebhookEvent } from './calendlyWebhook.model.js';

export const calendlyWebhookRepository = {
  findByDedupKey: (dedupKey) => CalendlyWebhookEvent.findOne({ dedupKey }).lean(),

  async create(data) {
    const doc = await CalendlyWebhookEvent.create(data);
    return doc.toObject();
  },

  updateById: (id, set) =>
    CalendlyWebhookEvent.findByIdAndUpdate(id, { $set: set }, { new: true, runValidators: true }).lean(),
};
