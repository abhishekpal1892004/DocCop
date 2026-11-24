import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

/**
 * In-memory rate limiter. Replaceable: swap `store` for a shared store
 * (e.g. Redis) later without touching app.js.
 */
export const createRateLimiter = (options = {}) =>
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: env.RATE_LIMIT_MAX,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) =>
      res.status(429).json({
        success: false,
        message: 'Too many requests, please try again later',
        code: 'RATE_LIMIT_EXCEEDED',
      }),
    ...options,
  });
