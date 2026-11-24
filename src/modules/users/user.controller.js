import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as userService from './user.service.js';

export const onboard = asyncHandler(async (req, res) => {
  const { user, created } = await userService.onboardUser(req.identity.clerkUserId, req.body.accountType);
  ApiResponse.send(res, {
    statusCode: created ? 201 : 200,
    data: { user: userService.toPublicProfile(user), created },
    message: created ? 'Account created' : 'Account already exists',
  });
});

export const getMe = asyncHandler(async (req, res) => {
  const user = await userService.getCurrentUser(req.identity.clerkUserId);
  if (!user) throw new ApiError(404, 'Onboarding required', 'ONBOARDING_REQUIRED');
  ApiResponse.send(res, { data: { user: userService.toPublicProfile(user) } });
});

export const updateMe = asyncHandler(async (req, res) => {
  const user = await userService.updateCurrentUser(req.identity.clerkUserId, req.body, req.currentUser);
  ApiResponse.send(res, { data: { user: userService.toPublicProfile(user) }, message: 'Profile updated' });
});
