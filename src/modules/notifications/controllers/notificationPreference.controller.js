import { ApiResponse } from '../../../utils/ApiResponse.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import {
  getMyNotificationPreferences,
  updateMyNotificationPreferences,
} from '../services/notificationPreference.service.js';

export const getPreferences = asyncHandler(async (req, res) => {
  const preferences = await getMyNotificationPreferences(req.currentUser);
  res.json(new ApiResponse({ preferences }, 'Notification preferences retrieved'));
});

export const patchPreferences = asyncHandler(async (req, res) => {
  const preferences = await updateMyNotificationPreferences(req.currentUser, req.body);
  res.json(new ApiResponse({ preferences }, 'Notification preferences updated'));
});
