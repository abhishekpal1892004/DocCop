import { ApiError } from '../../utils/ApiError.js';
import { AUDIT_ACTIONS, AUDIT_TARGET_TYPES } from '../auditLogs/auditLog.constants.js';
import { recordAuditEvent } from '../auditLogs/auditLog.service.js';
import { ROLES } from '../users/user.constants.js';
import { supportRepository } from './support.repository.js';

export const toPublicTicket = (t) => ({
  id: String(t._id),
  ticketNumber: t.ticketNumber,
  userId: String(t.userId),
  userRole: t.userRole,
  category: t.category,
  priority: t.priority,
  subject: t.subject,
  description: t.description,
  relatedAppointmentId: t.relatedAppointmentId ? String(t.relatedAppointmentId) : null,
  relatedDoctorId: t.relatedDoctorId ? String(t.relatedDoctorId) : null,
  relatedClinicId: t.relatedClinicId ? String(t.relatedClinicId) : null,
  status: t.status,
  assignedAdminId: t.assignedAdminId ? String(t.assignedAdminId) : null,
  resolutionNotes: t.resolutionNotes ?? '',
  resolvedAt: t.resolvedAt ?? null,
  createdAt: t.createdAt,
  updatedAt: t.updatedAt,
});

export const toPublicTicketMessage = (m) => ({
  id: String(m._id),
  ticketId: String(m.ticketId),
  senderId: String(m.senderId),
  senderRole: m.senderRole,
  message: m.message,
  isInternalNote: Boolean(m.isInternalNote),
  createdAt: m.createdAt,
});

const assertTicketAccess = (user, ticket) => {
  if (user.role === ROLES.ADMIN) return;
  if (String(ticket.userId) !== String(user._id)) {
    throw new ApiError(403, 'You do not have access to this support ticket', 'FORBIDDEN');
  }
};

export const createSupportTicket = async (user, input) => {
  const ticketNumber = await supportRepository.nextTicketNumber();
  const ticket = await supportRepository.createTicket({
    ticketNumber,
    userId: user._id,
    userRole: user.role,
    category: input.category,
    priority: input.priority,
    subject: input.subject,
    description: input.description,
    relatedAppointmentId: input.relatedAppointmentId ?? null,
    relatedDoctorId: input.relatedDoctorId ?? null,
    relatedClinicId: input.relatedClinicId ?? null,
    status: 'OPEN',
  });

  await supportRepository.createMessage({
    ticketId: ticket._id,
    senderId: user._id,
    senderRole: user.role,
    message: input.description,
    isInternalNote: false,
  });

  return toPublicTicket(ticket);
};

export const listMySupportTickets = async (user) => {
  const items = await supportRepository.listTicketsByUser(user._id);
  return items.map(toPublicTicket);
};

export const getSupportTicketDetails = async (user, id) => {
  const ticket = await supportRepository.findTicketById(id);
  if (!ticket) throw new ApiError(404, 'Support ticket not found', 'TICKET_NOT_FOUND');
  assertTicketAccess(user, ticket);

  const messages = await supportRepository.listMessagesByTicket(ticket._id, {
    includeInternal: user.role === ROLES.ADMIN,
  });

  return {
    ticket: toPublicTicket(ticket),
    messages: messages.map(toPublicTicketMessage),
  };
};

export const replyToSupportTicket = async (user, id, { message, isInternalNote }) => {
  const ticket = await supportRepository.findTicketById(id);
  if (!ticket) throw new ApiError(404, 'Support ticket not found', 'TICKET_NOT_FOUND');
  assertTicketAccess(user, ticket);

  if (isInternalNote && user.role !== ROLES.ADMIN) {
    throw new ApiError(403, 'Only admins can add internal notes', 'FORBIDDEN');
  }

  const createdMsg = await supportRepository.createMessage({
    ticketId: ticket._id,
    senderId: user._id,
    senderRole: user.role,
    message,
    isInternalNote: Boolean(isInternalNote && user.role === ROLES.ADMIN),
  });

  let nextStatus = ticket.status;
  if (user.role === ROLES.ADMIN && !isInternalNote && ticket.status === 'OPEN') {
    nextStatus = 'IN_PROGRESS';
  } else if (user.role !== ROLES.ADMIN && ticket.status === 'WAITING_FOR_USER') {
    nextStatus = 'IN_PROGRESS';
  }

  const updatedTicket =
    nextStatus !== ticket.status
      ? await supportRepository.updateTicketById(ticket._id, { status: nextStatus })
      : ticket;

  return {
    ticket: toPublicTicket(updatedTicket),
    message: toPublicTicketMessage(createdMsg),
  };
};

export const adminListSupportTickets = async (query) => {
  const { items, total, page, limit } = await supportRepository.listAllTickets(query);
  return {
    tickets: items.map(toPublicTicket),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
};

export const adminUpdateSupportTicket = async (adminUser, id, input, requestId = null) => {
  const existing = await supportRepository.findTicketById(id);
  if (!existing) throw new ApiError(404, 'Support ticket not found', 'TICKET_NOT_FOUND');

  const updates = {};
  if (input.status !== undefined) updates.status = input.status;
  if (input.priority !== undefined) updates.priority = input.priority;
  if (input.assignedAdminId !== undefined) updates.assignedAdminId = input.assignedAdminId;
  if (input.resolutionNotes !== undefined) updates.resolutionNotes = input.resolutionNotes;
  if (input.status === 'RESOLVED' || input.status === 'CLOSED') {
    updates.resolvedAt = existing.resolvedAt ?? new Date();
  }

  const updated = await supportRepository.updateTicketById(id, updates);

  await recordAuditEvent({
    actorUserId: adminUser._id,
    actorRole: adminUser.role,
    action: AUDIT_ACTIONS.SUPPORT_TICKET_UPDATED,
    targetType: AUDIT_TARGET_TYPES.SUPPORT_TICKET,
    targetId: existing._id,
    outcome: 'SUCCESS',
    requestId,
    previousStatus: existing.status,
    newStatus: updated.status,
    remarks: input.resolutionNotes ?? null,
  });

  return toPublicTicket(updated);
};
