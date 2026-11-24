import { logger } from '../../../utils/logger.js';
import { metrics } from '../../../utils/metrics.js';
import { runNotificationBatch } from '../services/notificationScheduler.service.js';

let isRunning = false;

export const runNotificationWorkerTick = async () => {
  if (isRunning) return [];
  isRunning = true;
  const start = process.hrtime.bigint();
  try {
    const processed = await runNotificationBatch();
    const durationMs = Number((Number(process.hrtime.bigint() - start) / 1e6).toFixed(2));
    metrics.recordWorkerTick({ durationMs });
    return processed;
  } catch (err) {
    const durationMs = Number((Number(process.hrtime.bigint() - start) / 1e6).toFixed(2));
    metrics.recordWorkerTick({ durationMs, error: err?.message || 'Worker tick error' });
    logger.error('notification_worker_tick_failed', { error: err, durationMs });
    return [];
  } finally {
    isRunning = false;
  }
};
