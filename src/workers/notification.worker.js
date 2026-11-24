import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { startNotificationScheduler, stopNotificationScheduler } from '../config/notificationScheduler.js';

let shuttingDown = false;

const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[worker] ${signal} received, shutting down notification worker...`);
  try {
    stopNotificationScheduler();
    await disconnectDatabase();
    process.exit(0);
  } catch (err) {
    console.error('[worker] Error during shutdown:', err?.message);
    process.exit(1);
  }
};

const start = async () => {
  await connectDatabase();
  startNotificationScheduler();
  console.log('[worker] MediBook notification worker running');
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start().catch((err) => {
  console.error('[worker] Failed to start:', err?.message);
  process.exit(1);
});
