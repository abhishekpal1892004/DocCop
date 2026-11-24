import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  bookAppointment,
  cancelAppointment,
  getAppointmentDetails,
  listDoctorAppointments,
  listPatientAppointments,
  startRescheduleAppointment,
} from './appointment.service.js';

export const postBookAppointment = asyncHandler(async (req, res) => {
  const idempotencyKey = req.get('Idempotency-Key');
  const { appointment, created } = await bookAppointment(req.currentUser, req.body, idempotencyKey);
  res
    .status(created ? 201 : 200)
    .json(new ApiResponse({ appointment }, created ? 'Appointment booked successfully' : 'Appointment already booked'));
});

export const getMyAppointments = asyncHandler(async (req, res) => {
  const result = await listPatientAppointments(req.currentUser, req.query);
  res.json(new ApiResponse(result, 'Patient appointments retrieved'));
});

export const getDoctorAppointments = asyncHandler(async (req, res) => {
  const result = await listDoctorAppointments(req.currentUser, req.query);
  res.json(new ApiResponse(result, 'Doctor appointments retrieved'));
});

export const getAppointmentById = asyncHandler(async (req, res) => {
  const appointment = await getAppointmentDetails(req.currentUser, req.params.id);
  res.json(new ApiResponse({ appointment }, 'Appointment retrieved'));
});

export const postCancelAppointment = asyncHandler(async (req, res) => {
  const appointment = await cancelAppointment(req.currentUser, req.params.id, req.body);
  res.json(new ApiResponse({ appointment }, 'Appointment cancelled'));
});

export const postRescheduleAppointment = asyncHandler(async (req, res) => {
  const result = await startRescheduleAppointment(req.currentUser, req.params.id);
  res.json(new ApiResponse(result, 'Calendly reschedule link retrieved'));
});
