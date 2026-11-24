import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { errorTracker } from '../utils/errorTracker.js';
import { logger } from '../utils/logger.js';
import { metrics } from '../utils/metrics.js';

/** Convert any thrown error into an ApiError with a safe, client-facing message. */
const normalizeError = (err) => {
  if (err instanceof ApiError) return err;

  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    return new ApiError(400, 'Validation failed', 'VALIDATION_ERROR', details);
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message }));
    return new ApiError(400, 'Validation failed', 'VALIDATION_ERROR', details);
  }

  if (err instanceof mongoose.Error.CastError) {
    return new ApiError(400, `Invalid value for ${err.path}`, 'INVALID_ID');
  }

  if (err?.code === 11000) {
    const fields = Object.keys(err.keyPattern ?? err.keyValue ?? {});
    const message = fields.length ? `Duplicate value for: ${fields.join(', ')}` : 'Duplicate value';
    return new ApiError(409, message, 'DUPLICATE_KEY');
  }

  // body-parser: malformed JSON
  if (err?.type === 'entity.parse.failed' || (err instanceof SyntaxError && err.status === 400 && 'body' in err)) {
    return new ApiError(400, 'Malformed JSON in request body', 'MALFORMED_JSON');
  }
  if (err?.type === 'entity.too.large') {
    return new ApiError(413, 'Request body too large', 'PAYLOAD_TOO_LARGE');
  }

  // CORS rejection
  if (err?.code === 'CORS_ORIGIN_NOT_ALLOWED') {
    return new ApiError(403, 'Origin not allowed', 'CORS_ORIGIN_NOT_ALLOWED');
  }

  return new ApiError(500, 'Something went wrong', 'INTERNAL_SERVER_ERROR');
};

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, _next) => {
  const apiError = normalizeError(err);

  if (apiError.statusCode >= 500) {
    const route = req.route?.path ? `${req.baseUrl || ''}${req.route.path}` : req.originalUrl?.split('?')[0] || '/';
    metrics.recordSystemError({
      code: apiError.code,
      message: err?.message || apiError.message,
      route,
      correlationId: req.id || null,
    });
    logger.error('unhandled_request_error', {
      correlationId: req.id || null,
      method: req.method,
      route,
      statusCode: apiError.statusCode,
      error: err,
    });
    errorTracker.captureException(err, {
      correlationId: req.id || null,
      method: req.method,
      route,
      statusCode: apiError.statusCode,
    });
  }

  const body = {
    success: false,
    message: apiError.message,
    code: apiError.code,
  };
  if (apiError.details) body.details = apiError.details;
  if (!env.isProduction && apiError.statusCode >= 500) body.stack = err?.stack;

  res.status(apiError.statusCode).json(body);
};
