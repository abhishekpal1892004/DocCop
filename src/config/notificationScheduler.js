import cron from 'node-cron';
import { env } from './env.js';
import { runNotificationWorkerTick } from '../modules/notifications/workers/notification.worker.js';

let scheduledTask = null;

const buildCronExpression = (intervalSeconds) => {
  if (intervalSeconds < 60) {
    return `*/${intervalSeconds} * * * * *`;
  }
  const mins = Math.max(1, Math.floor(intervalSeconds / 60));
  return `*/${mins} * * * *`;
};

export const startNotificationScheduler = () => {
  if (!env.NOTIFICATION_SCHEDULER_ENABLED || env.isTest) return null;
  if (scheduledTask) return scheduledTask;

  const expr = buildCronExpression(env.NOTIFICATION_WORKER_INTERVAL_SECONDS);
  scheduledTask = cron.schedule(expr, () => {
    runNotificationWorkerTick();
  });
  console.log(`[scheduler] Notification scheduler started (${expr})`);
  return scheduledTask;
};

export const stopNotificationScheduler = () => {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
};
