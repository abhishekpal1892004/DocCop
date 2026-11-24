import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  adminListSupportTickets,
  adminUpdateSupportTicket,
  createSupportTicket,
  getSupportTicketDetails,
  listMySupportTickets,
  replyToSupportTicket,
} from './support.service.js';

export const postCreateTicket = asyncHandler(async (req, res) => {
  const ticket = await createSupportTicket(req.currentUser, req.body);
  return ApiResponse.send(res, { statusCode: 201, data: { ticket }, message: 'Support ticket created' });
});

export const getMyTickets = asyncHandler(async (req, res) => {
  const tickets = await listMySupportTickets(req.currentUser);
  return ApiResponse.send(res, { statusCode: 200, data: { tickets }, message: 'Support tickets retrieved' });
});

export const getTicketDetails = asyncHandler(async (req, res) => {
  const result = await getSupportTicketDetails(req.currentUser, req.params.id);
  return ApiResponse.send(res, { statusCode: 200, data: result, message: 'Support ticket retrieved' });
});

export const postReplyTicket = asyncHandler(async (req, res) => {
  const result = await replyToSupportTicket(req.currentUser, req.params.id, req.body);
  return ApiResponse.send(res, { statusCode: 201, data: result, message: 'Reply posted' });
});

export const getAdminTickets = asyncHandler(async (req, res) => {
  const result = await adminListSupportTickets(req.query);
  return ApiResponse.send(res, { statusCode: 200, data: result, message: 'Support tickets retrieved' });
});

export const patchAdminTicket = asyncHandler(async (req, res) => {
  const ticket = await adminUpdateSupportTicket(req.currentUser, req.params.id, req.body, req.id ?? null);
  return ApiResponse.send(res, { statusCode: 200, data: { ticket }, message: 'Support ticket updated' });
});
