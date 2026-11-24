import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { startNotificationScheduler, stopNotificationScheduler } from './config/notificationScheduler.js';
import { logger } from './utils/logger.js';
import app from './app.js';

let server;
let shuttingDown = false;

const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('server_shutdown_started', { signal });

  const forceTimer = setTimeout(() => {
    logger.error('server_shutdown_forced_timeout', { signal });
    process.exit(1);
  }, 10000);
  forceTimer.unref();

  try {
    stopNotificationScheduler();
    if (server) await new Promise((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
    await disconnectDatabase();
    logger.info('server_shutdown_complete', { signal });
    process.exit(0);
  } catch (err) {
    logger.error('server_shutdown_error', { signal, error: err });
    process.exit(1);
  }
};

const start = async () => {
  try {
    await connectDatabase();
  } catch (err) {
    logger.error('server_db_connect_failed', { error: err });
    process.exit(1);
  }

  server = app.listen(env.PORT, () => {
    logger.info('server_started', { port: env.PORT, env: env.APP_ENV, embeddedWorker: env.RUN_EMBEDDED_WORKER });
    if (env.RUN_EMBEDDED_WORKER) {
      startNotificationScheduler();
    }
  });
  server.on('error', (err) => {
    console.error('[server] HTTP server error:', err.message);
    process.exit(1);
  });
  server.closeIdleConnections?.();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  console.error('[server] Unhandled rejection:', reason);
  shutdown('unhandledRejection');
});

start();
