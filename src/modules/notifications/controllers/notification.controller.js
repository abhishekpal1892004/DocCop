import { ApiResponse } from '../../../utils/ApiResponse.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import {
  listMyInAppNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '../services/notification.service.js';

export const getMyNotifications = asyncHandler(async (req, res) => {
  const result = await listMyInAppNotifications(req.currentUser, req.query);
  res.json(new ApiResponse(result, 'Notifications retrieved'));
});

export const patchMarkAsRead = asyncHandler(async (req, res) => {
  const notification = await markNotificationAsRead(req.currentUser, req.params.id);
  res.json(new ApiResponse({ notification }, 'Notification marked as read'));
});

export const patchMarkAllAsRead = asyncHandler(async (req, res) => {
  const result = await markAllNotificationsAsRead(req.currentUser);
  res.json(new ApiResponse(result, 'All notifications marked as read'));
});
