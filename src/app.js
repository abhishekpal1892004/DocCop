import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env.js';
import routes from './routes/index.js';
import webhookRoutes from './webhooks/clerk.webhook.js';
import twilioWebhookRoutes from './webhooks/twilio.webhook.js';
import calendlyWebhookRoutes from './modules/webhooks/calendlyWebhook.routes.js';
import razorpayWebhookRoutes from './modules/payments/paymentWebhook.controller.js';
import abdmWebhookRoutes from './webhooks/abdm.webhook.js';
import { requestIdMiddleware } from './middleware/requestId.middleware.js';
import { sanitizeMiddleware } from './middleware/sanitize.middleware.js';
import { requestLogger } from './middleware/requestLogger.middleware.js';
import { metricsMiddleware } from './utils/metrics.js';
import { createRateLimiter } from './middleware/rateLimiter.middleware.js';
import { notFoundHandler } from './middleware/notFound.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';

export const API_PREFIX = '/api/v1';

const app = express();

app.disable('x-powered-by');
// Set TRUST_PROXY behind a reverse proxy so rate limiting sees real client IPs.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      // Non-browser clients (curl, Postman, server-to-server) send no Origin header.
      if (!origin || env.CLIENT_ORIGINS.includes(origin)) return callback(null, true);
      const err = new Error('Origin not allowed');
      err.code = 'CORS_ORIGIN_NOT_ALLOWED';
      return callback(err);
    },
    credentials: true,
  })
);
app.use(requestIdMiddleware);
app.use(metricsMiddleware);
app.use(requestLogger);
app.use((req, res, next) => {
  res.setTimeout(env.REQUEST_TIMEOUT_MS, () => {
    if (!res.headersSent) {
      res.status(504).json({
        success: false,
        message: 'Request timed out',
        code: 'REQUEST_TIMEOUT',
      });
    }
  });
  next();
});
// Webhooks need the raw body for signature verification, so mount before express.json().
app.use(`${API_PREFIX}/webhooks/calendly`, calendlyWebhookRoutes);
app.use(`${API_PREFIX}/webhooks/razorpay`, razorpayWebhookRoutes);
app.use(`${API_PREFIX}/webhooks/abdm`, abdmWebhookRoutes);
app.use(`${API_PREFIX}/webhooks`, twilioWebhookRoutes);
app.use(`${API_PREFIX}/webhooks`, webhookRoutes);
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(sanitizeMiddleware);
app.use(API_PREFIX, createRateLimiter());

app.use(API_PREFIX, routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
