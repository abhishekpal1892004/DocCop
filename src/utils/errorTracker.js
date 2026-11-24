import axios from 'axios';
import { env } from '../config/env.js';
import { logger, redactSensitive } from './logger.js';

export const errorTracker = {
  isEnabled() {
    return Boolean(env.ERROR_TRACKING_ENABLED && env.ERROR_TRACKING_DSN);
  },

  async captureException(err, context = {}) {
    const sanitized = {
      name: err?.name || 'Error',
      message: redactSensitive(err?.message || 'Unknown error'),
      code: err?.code || 'INTERNAL_ERROR',
      correlationId: context.correlationId || null,
      method: context.method || null,
      route: context.route || null,
      statusCode: context.statusCode || 500,
      env: env.APP_ENV,
      version: env.APP_VERSION,
      timestamp: new Date().toISOString(),
    };

    if (!this.isEnabled()) {
      return { sent: false, reason: 'disabled', payload: sanitized };
    }

    try {
      await axios.post(env.ERROR_TRACKING_DSN, sanitized, { timeout: 3000 });
      return { sent: true, payload: sanitized };
    } catch (sendErr) {
      logger.warn('Failed to forward sanitized error to error tracker', {
        correlationId: context.correlationId,
        error: sendErr.message,
      });
      return { sent: false, reason: 'delivery_failed', payload: sanitized };
    }
  },
};
