import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { metrics } from '../../utils/metrics.js';
import { getIntegrationHealthSummary, getLiveness, getReadiness } from './health.service.js';

export const live = asyncHandler(async (_req, res) => {
  ApiResponse.send(res, { data: getLiveness(), message: 'Service is alive' });
});

export const ready = asyncHandler(async (_req, res) => {
  const { ready: isReady, ...report } = getReadiness();
  if (!isReady) {
    return res.status(503).json({
      success: false,
      message: 'Service not ready',
      code: 'SERVICE_UNAVAILABLE',
      data: report,
    });
  }
  ApiResponse.send(res, { data: report, message: 'Service is ready' });
});

export const getMetrics = asyncHandler(async (req, res) => {
  if (!env.METRICS_ENABLED) {
    throw new ApiError(404, 'Metrics endpoint is disabled', 'METRICS_DISABLED');
  }
  const token = req.headers['x-metrics-token'];
  const configuredToken = process.env.METRICS_AUTH_TOKEN || env.METRICS_AUTH_TOKEN;
  const hasValidToken = Boolean(configuredToken && token === configuredToken);
  const isAdmin = req.currentUser?.role === 'ADMIN';
  if (!hasValidToken && !isAdmin) {
    throw new ApiError(401, 'Metrics authentication required', 'UNAUTHORIZED');
  }

  return ApiResponse.send(res, {
    data: {
      ...metrics.getSnapshot(),
      integrationHealth: getIntegrationHealthSummary(),
    },
    message: 'Service metrics retrieved',
  });
});
