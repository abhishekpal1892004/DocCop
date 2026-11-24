import { logger } from '../utils/logger.js';

export const requestLogger = (req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number((Number(process.hrtime.bigint() - start) / 1e6).toFixed(2));
    const route = req.route?.path ? `${req.baseUrl || ''}${req.route.path}` : req.originalUrl?.split('?')[0] || '/';
    logger.info('http_request', {
      correlationId: req.id || null,
      method: req.method,
      route,
      statusCode: res.statusCode,
      durationMs,
    });
  });
  next();
};
