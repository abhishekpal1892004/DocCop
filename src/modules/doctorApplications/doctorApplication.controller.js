import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as applicationService from './doctorApplication.service.js';

const sendApp = (res, app, message, statusCode = 200) =>
  ApiResponse.send(res, {
    statusCode,
    message,
    data: { application: applicationService.toPublicApplication(app) },
  });

export const createApplication = asyncHandler(async (req, res) => {
  const app = await applicationService.createApplication(req.currentUser, req.body);
  sendApp(res, app, 'Doctor application created', 201);
});

export const getMyApplication = asyncHandler(async (req, res) => {
  const app = await applicationService.getMyApplication(req.currentUser);
  sendApp(res, app, 'Request successful');
});

export const updateMyApplication = asyncHandler(async (req, res) => {
  const app = await applicationService.updateMyApplication(req.currentUser, req.body);
  sendApp(res, app, 'Doctor application updated');
});

export const submitApplication = asyncHandler(async (req, res) => {
  const { application, submitted } = await applicationService.submitApplication(req.currentUser);
  sendApp(
    res,
    application,
    submitted ? 'Doctor application submitted for verification' : 'Doctor application already submitted'
  );
});

export const getApplicationStatus = asyncHandler(async (req, res) => {
  const status = await applicationService.getApplicationStatus(req.currentUser);
  ApiResponse.send(res, { data: { status } });
});
