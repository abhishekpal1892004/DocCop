import { randomUUID } from 'node:crypto';

export const createFakeOrganizationRepository = () => {
  const store = new Map();
  const repo = {
    create: async (data) => {
      const doc = { _id: randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...structuredClone(data) };
      store.set(String(doc._id), doc);
      return structuredClone(doc);
    },
    findById: async (id) => (store.has(String(id)) ? structuredClone(store.get(String(id))) : null),
    findByOwnerUserId: async (ownerUserId) => {
      for (const o of store.values()) {
        if (String(o.ownerUserId) === String(ownerUserId)) return structuredClone(o);
      }
      return null;
    },
    updateByOwnerUserId: async (ownerUserId, set) => {
      for (const o of store.values()) {
        if (String(o.ownerUserId) === String(ownerUserId)) {
          Object.assign(o, set, { updatedAt: new Date() });
          return structuredClone(o);
        }
      }
      return null;
    },
    updateById: async (id, set) => {
      const doc = store.get(String(id));
      if (!doc) return null;
      Object.assign(doc, set, { updatedAt: new Date() });
      return structuredClone(doc);
    },
  };
  return { repo, store };
};

export const createFakeStaffRepository = () => {
  const invitations = new Map();
  const memberships = new Map();

  const repo = {
    createInvitation: async (data) => {
      const doc = { _id: randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...structuredClone(data) };
      invitations.set(String(doc._id), doc);
      return structuredClone(doc);
    },
    findPendingInvitationByEmailAndClinic: async (email, clinicId) => {
      const now = new Date();
      for (const inv of invitations.values()) {
        if (
          inv.email === email.toLowerCase() &&
          inv.clinicIds.some((c) => String(c) === String(clinicId)) &&
          inv.invitationStatus === 'PENDING' &&
          new Date(inv.expiresAt) > now
        ) {
          return structuredClone(inv);
        }
      }
      return null;
    },
    findInvitationByTokenHash: async (tokenHash) => {
      for (const inv of invitations.values()) {
        if (inv.tokenHash === tokenHash) return structuredClone(inv);
      }
      return null;
    },
    consumePendingInvitation: async (id, userId, now = new Date()) => {
      const inv = invitations.get(String(id));
      if (!inv || inv.invitationStatus !== 'PENDING' || new Date(inv.expiresAt) <= now) return null;
      inv.invitationStatus = 'ACCEPTED';
      inv.acceptedByUserId = userId;
      inv.acceptedAt = now;
      return structuredClone(inv);
    },
    updateInvitationById: async (id, set) => {
      const inv = invitations.get(String(id));
      if (!inv) return null;
      Object.assign(inv, set);
      return structuredClone(inv);
    },
    createMembership: async (data) => {
      const doc = { _id: randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...structuredClone(data) };
      memberships.set(String(doc._id), doc);
      return structuredClone(doc);
    },
    findMembershipById: async (id) =>
      memberships.has(String(id)) ? structuredClone(memberships.get(String(id))) : null,
    findActiveMembershipByUserId: async (userId) => {
      for (const m of memberships.values()) {
        if (String(m.userId) === String(userId) && m.status === 'ACTIVE') return structuredClone(m);
      }
      return null;
    },
    findActiveMembershipsByClinicId: async (clinicId) =>
      [...memberships.values()]
        .filter((m) => m.status === 'ACTIVE' && m.clinicIds.some((c) => String(c) === String(clinicId)))
        .map((m) => structuredClone(m)),
    updateMembershipById: async (id, set) => {
      const m = memberships.get(String(id));
      if (!m) return null;
      Object.assign(m, set, { updatedAt: new Date() });
      return structuredClone(m);
    },
  };
  return { repo, invitations, memberships };
};

export const createFakeWaitlistRepository = () => {
  const waitlists = new Map();
  const offers = new Map();

  const repo = {
    create: async (data) => {
      const doc = { _id: randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...structuredClone(data) };
      waitlists.set(String(doc._id), doc);
      return structuredClone(doc);
    },
    findById: async (id) => (waitlists.has(String(id)) ? structuredClone(waitlists.get(String(id))) : null),
    listByPatient: async (patientId) =>
      [...waitlists.values()]
        .filter((w) => String(w.patientId) === String(patientId))
        .map((w) => structuredClone(w)),
    findEligibleActive: async (doctorId, appointmentTypeId) =>
      [...waitlists.values()]
        .filter(
          (w) =>
            String(w.doctorId) === String(doctorId) &&
            String(w.appointmentTypeId) === String(appointmentTypeId) &&
            w.status === 'ACTIVE'
        )
        .slice(0, 5)
        .map((w) => structuredClone(w)),
    updateById: async (id, set) => {
      const doc = waitlists.get(String(id));
      if (!doc) return null;
      Object.assign(doc, set, { updatedAt: new Date() });
      return structuredClone(doc);
    },
    createOffer: async (data) => {
      const doc = { _id: randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...structuredClone(data) };
      offers.set(String(doc._id), doc);
      return structuredClone(doc);
    },
    findOfferById: async (id) => (offers.has(String(id)) ? structuredClone(offers.get(String(id))) : null),
    claimPendingOffer: async (id, patientId, now = new Date()) => {
      const o = offers.get(String(id));
      if (!o || String(o.patientId) !== String(patientId) || o.status !== 'PENDING' || new Date(o.expiresAt) <= now) {
        return null;
      }
      o.status = 'ACCEPTED';
      o.acceptedAt = now;
      return structuredClone(o);
    },
    updateOfferById: async (id, set) => {
      const o = offers.get(String(id));
      if (!o) return null;
      Object.assign(o, set, { updatedAt: new Date() });
      return structuredClone(o);
    },
  };
  return { repo, waitlists, offers };
};

export const createFakeFollowUpRepository = () => {
  const followUps = new Map();
  let seq = 1;
  const nextId = () => `65a0f00000000000000000${String(seq++).padStart(2, '0')}`;

  const repo = {
    create: async (data) => {
      const id = nextId();
      const doc = { _id: id, ...data, createdAt: new Date(), updatedAt: new Date() };
      followUps.set(id, doc);
      return structuredClone(doc);
    },
    findById: async (id) => (followUps.has(String(id)) ? structuredClone(followUps.get(String(id))) : null),
    listByPatient: async (patientId) =>
      [...followUps.values()]
        .filter((f) => String(f.patientId) === String(patientId))
        .sort((a, b) => new Date(a.recommendedDate) - new Date(b.recommendedDate))
        .map((f) => structuredClone(f)),
    listByDoctor: async (doctorId) =>
      [...followUps.values()]
        .filter((f) => String(f.doctorId) === String(doctorId))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map((f) => structuredClone(f)),
    updateById: async (id, set) => {
      const f = followUps.get(String(id));
      if (!f) return null;
      Object.assign(f, set, { updatedAt: new Date() });
      return structuredClone(f);
    },
  };
  return { repo, followUps };
};

export const createFakeSupportRepository = () => {
  const tickets = new Map();
  const messages = new Map();
  let tSeq = 1;
  let mSeq = 1;
  const nextTicketId = () => `65a1000000000000000000${String(tSeq++).padStart(2, '0')}`;
  const nextMsgId = () => `65a1100000000000000000${String(mSeq++).padStart(2, '0')}`;

  const repo = {
    nextTicketNumber: async () => `MB-SUP-${String(tSeq).padStart(5, '0')}`,
    createTicket: async (data) => {
      const id = nextTicketId();
      const doc = { _id: id, ...data, createdAt: new Date(), updatedAt: new Date() };
      tickets.set(id, doc);
      return structuredClone(doc);
    },
    findTicketById: async (id) => (tickets.has(String(id)) ? structuredClone(tickets.get(String(id))) : null),
    listTicketsByUser: async (userId) =>
      [...tickets.values()]
        .filter((t) => String(t.userId) === String(userId))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map((t) => structuredClone(t)),
    listAllTickets: async ({ status, category, priority, page = 1, limit = 20 }) => {
      const filtered = [...tickets.values()].filter((t) => {
        if (status && t.status !== status) return false;
        if (category && t.category !== category) return false;
        if (priority && t.priority !== priority) return false;
        return true;
      });
      const skip = (page - 1) * limit;
      return {
        items: filtered.slice(skip, skip + limit).map((t) => structuredClone(t)),
        total: filtered.length,
        page,
        limit,
      };
    },
    updateTicketById: async (id, set) => {
      const t = tickets.get(String(id));
      if (!t) return null;
      Object.assign(t, set, { updatedAt: new Date() });
      return structuredClone(t);
    },
    createMessage: async (data) => {
      const id = nextMsgId();
      const doc = { _id: id, ...data, createdAt: new Date(), updatedAt: new Date() };
      messages.set(id, doc);
      return structuredClone(doc);
    },
    listMessagesByTicket: async (ticketId, { includeInternal = false } = {}) =>
      [...messages.values()]
        .filter((m) => String(m.ticketId) === String(ticketId) && (includeInternal || !m.isInternalNote))
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        .map((m) => structuredClone(m)),
  };
  return { repo, tickets, messages };
};
