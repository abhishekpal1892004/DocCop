import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  acceptWaitlistOffer,
  declineWaitlistOffer,
  getWaitlistOffer,
  joinWaitlist,
  leaveWaitlist,
  listMyWaitlist,
} from './waitlist.service.js';

export const postJoinWaitlist = asyncHandler(async (req, res) => {
  const waitlist = await joinWaitlist(req.currentUser, req.body);
  res.status(201).json(new ApiResponse({ waitlist }, 'Added to appointment waitlist'));
});

export const getMyWaitlist = asyncHandler(async (req, res) => {
  const waitlist = await listMyWaitlist(req.currentUser);
  res.json(new ApiResponse({ waitlist }, 'Waitlist entries retrieved'));
});

export const deleteWaitlistEntry = asyncHandler(async (req, res) => {
  const waitlist = await leaveWaitlist(req.currentUser, req.params.id);
  res.json(new ApiResponse({ waitlist }, 'Removed from waitlist'));
});

export const getOffer = asyncHandler(async (req, res) => {
  const offer = await getWaitlistOffer(req.currentUser, req.params.id);
  res.json(new ApiResponse({ offer }, 'Waitlist offer retrieved'));
});

export const postAcceptOffer = asyncHandler(async (req, res) => {
  const result = await acceptWaitlistOffer(req.currentUser, req.params.id);
  res.status(201).json(new ApiResponse(result, 'Waitlist offer accepted and appointment booked'));
});

export const postDeclineOffer = asyncHandler(async (req, res) => {
  const offer = await declineWaitlistOffer(req.currentUser, req.params.id);
  res.json(new ApiResponse({ offer }, 'Waitlist offer declined'));
});
