import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ENV: z.enum(['development', 'test', 'staging', 'production']).optional(),
  APP_VERSION: z.string().trim().default('1.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(30000),
  RUN_EMBEDDED_WORKER: z.coerce.boolean().default(false),
  METRICS_ENABLED: z.coerce.boolean().default(true),
  METRICS_AUTH_TOKEN: z.string().trim().optional(),
  ERROR_TRACKING_ENABLED: z.coerce.boolean().default(false),
  ERROR_TRACKING_DSN: z.string().trim().optional(),
  MONGODB_URI: z
    .string({ required_error: 'MONGODB_URI is required' })
    .min(1, 'MONGODB_URI is required')
    .refine((v) => /^mongodb(\+srv)?:\/\//.test(v), 'MONGODB_URI must start with mongodb:// or mongodb+srv://'),
  CLIENT_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((v) =>
      v
        .split(',')
        .map((o) => o.trim().replace(/\/+$/, ''))
        .filter(Boolean)
    )
    .refine((list) => list.length > 0, 'CLIENT_ORIGINS must contain at least one origin')
    .refine((list) => list.every((o) => o !== '*'), 'CLIENT_ORIGINS must not contain a wildcard'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  CLERK_PUBLISHABLE_KEY: z.string().trim().optional(),
  CLERK_SECRET_KEY: z.string().trim().optional(),
  CLERK_WEBHOOK_SIGNING_SECRET: z.string().trim().optional(),
  // Optional PEM public key enabling networkless session verification (also used by tests).
  CLERK_JWT_KEY: z.string().trim().optional(),
  NMC_SEARCH_URL: z.string().url().default('https://nmc.org.in/indian-medical-register/search'),
  NMC_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  NMC_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
  NMC_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(10 * 60 * 1000),
  CALENDLY_CLIENT_ID: z.string().trim().optional(),
  CALENDLY_CLIENT_SECRET: z.string().trim().optional(),
  CALENDLY_REDIRECT_URI: z.string().url().default('http://localhost:5000/api/v1/integrations/calendly/callback'),
  CALENDLY_WEBHOOK_SIGNING_KEY: z.string().trim().optional(),
  CALENDLY_TOKEN_ENCRYPTION_KEY: z.string().trim().optional(),
  CALENDLY_AUTH_BASE_URL: z.string().url().default('https://auth.calendly.com'),
  CALENDLY_API_BASE_URL: z.string().url().default('https://api.calendly.com'),
  CALENDLY_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  CALENDLY_AVAILABILITY_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),
  CALENDLY_AVAILABILITY_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60 * 1000),
  TWILIO_ACCOUNT_SID: z.string().trim().optional(),
  TWILIO_AUTH_TOKEN: z.string().trim().optional(),
  TWILIO_MESSAGING_SERVICE_SID: z.string().trim().optional(),
  TWILIO_SMS_FROM_NUMBER: z.string().trim().optional(),
  TWILIO_WHATSAPP_FROM: z.string().trim().default('whatsapp:+14155238886'),
  TWILIO_CONTENT_SID_APPOINTMENT_CONFIRMED: z.string().trim().optional(),
  TWILIO_CONTENT_SID_APPOINTMENT_REMINDER: z.string().trim().optional(),
  TWILIO_CONTENT_SID_APPOINTMENT_CANCELLED: z.string().trim().optional(),
  TWILIO_CONTENT_SID_APPOINTMENT_RESCHEDULED: z.string().trim().optional(),
  TWILIO_STATUS_CALLBACK_URL: z.string().trim().optional(),
  TWILIO_WHATSAPP_SANDBOX_ENABLED: z.coerce.boolean().default(true),
  TWILIO_DLT_ENTITY_ID: z.string().trim().optional(),
  TWILIO_DLT_SENDER_ID: z.string().trim().optional(),
  NOTIFICATION_SCHEDULER_ENABLED: z.coerce.boolean().default(true),
  NOTIFICATION_WORKER_INTERVAL_SECONDS: z.coerce.number().int().min(5).max(3600).default(60),
  NOTIFICATION_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3),
  NOTIFICATION_RETRY_BASE_SECONDS: z.coerce.number().int().min(5).max(3600).default(60),
  MEDICAL_DOC_ENCRYPTION_ACTIVE_VERSION: z.string().trim().default('v1'),
  MEDICAL_DOC_ENCRYPTION_KEY_V1: z.string().trim().optional(),
  MEDICAL_DOC_ENCRYPTION_KEY_V2: z.string().trim().optional(),
  CLAMAV_SCAN_ENABLED: z.coerce.boolean().default(false),
  RAZORPAY_KEY_ID: z.string().trim().optional(),
  RAZORPAY_KEY_SECRET: z.string().trim().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().trim().optional(),
  RAZORPAY_CALLBACK_URL: z.string().trim().optional(),
  RAZORPAY_PAYMENT_CURRENCY: z.string().trim().default('INR'),
  RAZORPAY_PAYMENT_TIMEOUT_MINUTES: z.coerce.number().int().min(1).max(120).default(10),
  AGORA_APP_ID: z.string().trim().optional(),
  AGORA_APP_CERTIFICATE: z.string().trim().optional(),
  AGORA_TOKEN_EXPIRY_SECONDS: z.coerce.number().int().min(60).max(86400).default(3600),
  AGORA_ENABLED: z.coerce.boolean().default(true),
  PAYMENT_ENABLED: z.coerce.boolean().default(true),
  VIDEO_CONSULTATION_ENABLED: z.coerce.boolean().default(true),
  QUEUE_MANAGEMENT_ENABLED: z.coerce.boolean().default(true),
  REVIEWS_ENABLED: z.coerce.boolean().default(true),
  ABDM_ENABLED: z.coerce.boolean().default(false),
  ABDM_ENVIRONMENT: z.enum(['SANDBOX', 'PRODUCTION']).default('SANDBOX'),
  ABDM_CLIENT_ID: z.string().trim().optional(),
  ABDM_CLIENT_SECRET: z.string().trim().optional(),
  ABDM_BASE_URL: z.string().trim().default('https://dev.abdm.gov.in'),
  ABDM_ABHA_BASE_URL: z.string().trim().default('https://abhasbx.abdm.gov.in'),
  ABDM_CM_ID: z.string().trim().default('sbx'),
  ABDM_CALLBACK_BASE_URL: z.string().trim().optional(),
  ABDM_FACILITY_ID: z.string().trim().optional(),
  ABDM_INTEGRATION_ROLE: z.string().trim().default(''),
  ABDM_ENCRYPTION_KEY: z.string().trim().optional(),
  ABDM_WEBHOOK_SECRET: z.string().trim().optional(),
  ABDM_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(15000),
}).superRefine((v, ctx) => {
  if (v.NODE_ENV === 'test') return;
  const rules = { CLERK_PUBLISHABLE_KEY: 'pk_', CLERK_SECRET_KEY: 'sk_' };
  for (const [key, prefix] of Object.entries(rules)) {
    if (!v[key]) ctx.addIssue({ code: 'custom', path: [key], message: `${key} is required` });
    else if (!v[key].startsWith(prefix)) ctx.addIssue({ code: 'custom', path: [key], message: `${key} must start with ${prefix}` });
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((i) => `  - ${i.path.join('.') || 'env'}: ${i.message}`)
    .join('\n');
  console.error(`Invalid environment configuration:\n${details}`);
  process.exit(1);
}

export const env = Object.freeze({
  ...parsed.data,
  APP_ENV: parsed.data.APP_ENV || parsed.data.NODE_ENV,
  isProduction: parsed.data.NODE_ENV === 'production',
  isStaging: parsed.data.APP_ENV === 'staging',
  isTest: parsed.data.NODE_ENV === 'test',
});
