import { env } from '../config/env.js';

const SENSITIVE_KEY_PATTERN =
  /password|passcode|secret|token|authorization|cookie|apikey|api_key|abha|aadhaar|diagnosis|medicines|clinicalnotes|medicalrecord|prescription|symptoms|otp|privatekey/i;

export const redactSensitive = (value, depth = 0) => {
  if (value === null || value === undefined) return value;
  if (depth > 5) return '[TRUNCATED]';
  if (typeof value === 'string') {
    if (/^Bearer\s+/i.test(value)) return 'Bearer [REDACTED]';
    return value.length > 500 ? `${value.slice(0, 500)}...[TRUNCATED]` : value;
  }
  if (typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactSensitive(value.message, depth + 1),
      code: value.code,
    };
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => redactSensitive(item, depth + 1));
  }

  const out = {};
  for (const [key, val] of Object.entries(value)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      out[key] = '[REDACTED]';
    } else {
      out[key] = redactSensitive(val, depth + 1);
    }
  }
  return out;
};

const emit = (level, message, meta = {}) => {
  if (env.isTest && process.env.LOG_LEVEL !== 'debug') return;

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: 'medibook-api',
    env: env.APP_ENV,
    message,
    ...redactSensitive(meta),
  };

  if (env.isProduction || env.isStaging) {
    const line = JSON.stringify(entry);
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  } else {
    const corr = entry.correlationId ? ` [${entry.correlationId}]` : '';
    const line = `[${entry.timestamp}] ${level.toUpperCase()}${corr}: ${message}`;
    if (level === 'error') console.error(line, Object.keys(meta).length ? redactSensitive(meta) : '');
    else if (level === 'warn') console.warn(line, Object.keys(meta).length ? redactSensitive(meta) : '');
    else console.log(line);
  }
};

export const logger = {
  info: (message, meta) => emit('info', message, meta),
  warn: (message, meta) => emit('warn', message, meta),
  error: (message, meta) => emit('error', message, meta),
};
