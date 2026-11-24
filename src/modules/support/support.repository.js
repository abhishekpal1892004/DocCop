import { SupportMessage } from './supportMessage.model.js';
import { SupportSequence, SupportTicket } from './supportTicket.model.js';

export const supportRepository = {
  async nextTicketNumber() {
    const seqDoc = await SupportSequence.findOneAndUpdate(
      { _id: 'support_ticket' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    ).lean();
    return `MB-SUP-${String(seqDoc.seq).padStart(5, '0')}`;
  },

  async createTicket(data) {
    const doc = await SupportTicket.create(data);
    return doc.toObject();
  },

  findTicketById: (id) => SupportTicket.findById(id).lean(),

  listTicketsByUser: (userId) => SupportTicket.find({ userId }).sort({ createdAt: -1 }).lean(),

  async listAllTickets({ status, category, priority, page = 1, limit = 20 }) {
    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (priority) filter.priority = priority;
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      SupportTicket.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      SupportTicket.countDocuments(filter),
    ]);
    return { items, total, page, limit };
  },

  updateTicketById: (id, set) =>
    SupportTicket.findByIdAndUpdate(id, { $set: set }, { new: true, runValidators: true }).lean(),

  async createMessage(data) {
    const doc = await SupportMessage.create(data);
    return doc.toObject();
  },

  listMessagesByTicket: (ticketId, { includeInternal = false } = {}) => {
    const filter = includeInternal ? { ticketId } : { ticketId, isInternalNote: false };
    return SupportMessage.find(filter).sort({ createdAt: 1 }).lean();
  },
};
