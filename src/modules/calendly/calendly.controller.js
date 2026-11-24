import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  beginCalendlyOAuth,
  disconnectCalendly,
  fetchDoctorCalendlyEventTypes,
  getCalendlyStatus,
  handleCalendlyCallback,
  listMyAppointmentTypes,
  selectCalendlyEventType,
  syncDoctorEventTypes,
  updateMyAppointmentType,
  updateMyAppointmentTypeStatus,
} from './calendly.service.js';

export const connectCalendly = asyncHandler(async (req, res) => {
  const result = await beginCalendlyOAuth(req.currentUser);
  res.json(new ApiResponse(result, 'Calendly authorization URL generated'));
});

export const calendlyCallback = asyncHandler(async (req, res) => {
  const connection = await handleCalendlyCallback(req.query);
  res.json(new ApiResponse({ connection }, 'Calendly account connected'));
});

export const getStatus = asyncHandler(async (req, res) => {
  const connection = await getCalendlyStatus(req.currentUser);
  res.json(new ApiResponse({ connection }, 'Calendly connection status retrieved'));
});

export const getEventTypes = asyncHandler(async (req, res) => {
  const eventTypes = await fetchDoctorCalendlyEventTypes(req.currentUser);
  res.json(new ApiResponse({ eventTypes }, 'Calendly event types retrieved'));
});

export const syncEventTypes = asyncHandler(async (req, res) => {
  const result = await syncDoctorEventTypes(req.currentUser);
  res.json(new ApiResponse(result, 'Calendly event types synced'));
});

export const selectEventType = asyncHandler(async (req, res) => {
  const appointmentType = await selectCalendlyEventType(req.currentUser, req.body);
  res.status(201).json(new ApiResponse({ appointmentType }, 'Calendly event type selected'));
});

export const disconnect = asyncHandler(async (req, res) => {
  const connection = await disconnectCalendly(req.currentUser);
  res.json(new ApiResponse({ connection }, 'Calendly account disconnected'));
});

// Doctor Appointment Type controllers
export const getMyAppointmentTypes = asyncHandler(async (req, res) => {
  const appointmentTypes = await listMyAppointmentTypes(req.currentUser);
  res.json(new ApiResponse({ appointmentTypes }, 'Appointment types retrieved'));
});

export const createMyAppointmentType = asyncHandler(async (req, res) => {
  const appointmentType = await selectCalendlyEventType(req.currentUser, req.body);
  res.status(201).json(new ApiResponse({ appointmentType }, 'Appointment type created'));
});

export const patchMyAppointmentType = asyncHandler(async (req, res) => {
  const appointmentType = await updateMyAppointmentType(req.currentUser, req.params.id, req.body);
  res.json(new ApiResponse({ appointmentType }, 'Appointment type updated'));
});

export const patchMyAppointmentTypeStatus = asyncHandler(async (req, res) => {
  const appointmentType = await updateMyAppointmentTypeStatus(req.currentUser, req.params.id, req.body.isActive);
  res.json(new ApiResponse({ appointmentType }, 'Appointment type status updated'));
});
