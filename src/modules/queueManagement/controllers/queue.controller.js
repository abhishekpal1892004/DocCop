import { ApiResponse } from '../../../utils/ApiResponse.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { QUEUE_SESSION_STATUS } from '../models/queueSession.model.js';
import {
  callNextPatient,
  completeQueueEntry,
  getCurrentDoctorQueue,
  getPatientQueuePosition,
  openDoctorQueueSession,
  patientCheckIn,
  setQueueSessionStatus,
  skipQueueEntry,
  startQueueEntry,
} from '../services/queue.service.js';

export const postOpenQueue = asyncHandler(async (req, res) => {
  const session = await openDoctorQueueSession(req.currentUser, req.body);
  res.status(201).json(new ApiResponse({ session }, 'Queue session opened'));
});

export const getCurrentQueue = asyncHandler(async (req, res) => {
  const result = await getCurrentDoctorQueue(req.currentUser);
  res.json(new ApiResponse(result, 'Current queue retrieved'));
});

export const postCheckIn = asyncHandler(async (req, res) => {
  const result = await patientCheckIn(req.currentUser, req.body);
  res.status(201).json(new ApiResponse(result, 'Checked in to clinic queue'));
});

export const getMyPosition = asyncHandler(async (req, res) => {
  const position = await getPatientQueuePosition(req.currentUser, req.query);
  res.json(new ApiResponse({ position }, 'Queue position retrieved'));
});

export const patchCallNext = asyncHandler(async (req, res) => {
  const result = await callNextPatient(req.currentUser, req.params.id);
  res.json(new ApiResponse(result, 'Next patient called'));
});

export const patchStartEntry = asyncHandler(async (req, res) => {
  const entry = await startQueueEntry(req.currentUser, req.params.id, req.params.entryId);
  res.json(new ApiResponse({ entry }, 'Consultation started'));
});

export const patchCompleteEntry = asyncHandler(async (req, res) => {
  const entry = await completeQueueEntry(req.currentUser, req.params.id, req.params.entryId);
  res.json(new ApiResponse({ entry }, 'Consultation completed'));
});

export const patchSkipEntry = asyncHandler(async (req, res) => {
  const entry = await skipQueueEntry(req.currentUser, req.params.id, req.params.entryId);
  res.json(new ApiResponse({ entry }, 'Patient skipped'));
});

export const patchPauseQueue = asyncHandler(async (req, res) => {
  const session = await setQueueSessionStatus(req.currentUser, req.params.id, QUEUE_SESSION_STATUS.PAUSED);
  res.json(new ApiResponse({ session }, 'Queue paused'));
});

export const patchResumeQueue = asyncHandler(async (req, res) => {
  const session = await setQueueSessionStatus(req.currentUser, req.params.id, QUEUE_SESSION_STATUS.OPEN);
  res.json(new ApiResponse({ session }, 'Queue resumed'));
});

export const patchCloseQueue = asyncHandler(async (req, res) => {
  const session = await setQueueSessionStatus(req.currentUser, req.params.id, QUEUE_SESSION_STATUS.CLOSED);
  res.json(new ApiResponse({ session }, 'Queue closed'));
});
