import { QUEUE_ENTRY_STATUS, QueueEntry } from './models/queueEntry.model.js';
import { QUEUE_SESSION_STATUS, QueueSession } from './models/queueSession.model.js';

export const queueRepository = {
  async createSession(data) {
    const doc = await QueueSession.create(data);
    return doc.toObject();
  },

  findSessionById: (id) => QueueSession.findById(id).lean(),

  findSessionByDoctorAndDate: (doctorId, dateKey) =>
    QueueSession.findOne({ doctorId, dateKey }).lean(),

  updateSessionById: (id, doctorId, set) =>
    QueueSession.findOneAndUpdate({ _id: id, doctorId }, { $set: set }, { new: true, runValidators: true }).lean(),

  allocateNextToken: (sessionId) =>
    QueueSession.findOneAndUpdate(
      { _id: sessionId, status: QUEUE_SESSION_STATUS.OPEN },
      { $inc: { nextTokenSequence: 1 } },
      { new: true }
    ).lean(),

  async createEntry(data) {
    const doc = await QueueEntry.create(data);
    return doc.toObject();
  },

  findEntryById: (id) => QueueEntry.findById(id).lean(),

  findEntryByAppointmentId: (appointmentId) => QueueEntry.findOne({ appointmentId }).lean(),

  listEntriesForSession: (queueSessionId) =>
    QueueEntry.find({ queueSessionId }).sort({ tokenNumber: 1 }).lean(),

  countWaitingAhead: (queueSessionId, tokenNumber) =>
    QueueEntry.countDocuments({
      queueSessionId,
      status: QUEUE_ENTRY_STATUS.WAITING,
      tokenNumber: { $lt: tokenNumber },
    }),

  claimNextWaitingEntry: (queueSessionId, now = new Date()) =>
    QueueEntry.findOneAndUpdate(
      { queueSessionId, status: QUEUE_ENTRY_STATUS.WAITING },
      { $set: { status: QUEUE_ENTRY_STATUS.CALLED, calledAt: now } },
      { new: true, sort: { tokenNumber: 1 } }
    ).lean(),

  updateEntryStatus: (entryId, queueSessionId, allowedStatuses, set) =>
    QueueEntry.findOneAndUpdate(
      { _id: entryId, queueSessionId, status: { $in: allowedStatuses } },
      { $set: set },
      { new: true, runValidators: true }
    ).lean(),
};
