import { isDatabaseReady } from '../../config/database.js';
import { env } from '../../config/env.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getCircuitBreakerStates } from '../../utils/circuitBreaker.js';
import { metrics } from '../../utils/metrics.js';
import { getIntegrationHealthSummary } from '../health/health.service.js';
import { Notification } from '../notifications/models/notification.model.js';

export const getAdminSystemHealth = asyncHandler(async (_req, res) => {
  const snap = metrics.getSnapshot();
  const dbReady = isDatabaseReady();

  let workerQueueStats = { pendingJobs: 0, failedJobs: 0, oldestPendingJobAt: null };
  if (dbReady) {
    const [pendingJobs, failedJobs, oldestPending] = await Promise.all([
      Notification.countDocuments({ status: 'PENDING' }),
      Notification.countDocuments({ status: 'FAILED' }),
      Notification.findOne({ status: 'PENDING' }).sort({ createdAt: 1 }).select('createdAt').lean(),
    ]);
    workerQueueStats = {
      pendingJobs,
      failedJobs,
      oldestPendingJobAt: oldestPending?.createdAt ?? null,
    };
  }

  return ApiResponse.send(res, {
    statusCode: 200,
    data: {
      application: {
        status: dbReady ? 'HEALTHY' : 'DEGRADED',
        environment: env.APP_ENV,
        version: env.APP_VERSION,
        database: dbReady ? 'up' : 'down',
        uptimeSeconds: snap.uptimeSeconds,
        errorRate: snap.http.errorRate,
        latencyMs: snap.http.latencyMs,
      },
      worker: {
        ...snap.worker,
        ...workerQueueStats,
      },
      integrations: getIntegrationHealthSummary(),
      circuitBreakers: getCircuitBreakerStates(),
      operationalEvents: {
        recentSystemErrors: snap.recentSystemErrors,
      },
    },
    message: 'Admin system health retrieved',
  });
});
