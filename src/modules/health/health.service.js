import { isDatabaseReady } from '../../config/database.js';
import { env } from '../../config/env.js';
import { getAbdmRuntimeConfig } from '../../integrations/abdm/abdm.config.js';
import { metrics } from '../../utils/metrics.js';

export const getLiveness = () => ({
  status: 'ok',
  uptime: Math.round(process.uptime()),
  version: env.APP_VERSION,
  environment: env.APP_ENV,
  timestamp: new Date().toISOString(),
});

const classifyIntegration = (configured, stats) => {
  if (!configured) return 'NOT_CONFIGURED';
  if (!stats || stats.calls === 0) return 'HEALTHY';
  const failureRate = stats.failures / stats.calls;
  if (failureRate >= 0.8 && stats.failures >= 3) return 'UNAVAILABLE';
  if (stats.failures > 0) return 'DEGRADED';
  return 'HEALTHY';
};

export const getIntegrationHealthSummary = () => {
  const snap = metrics.getSnapshot();
  const abdmCfg = getAbdmRuntimeConfig();
  return {
    clerk: classifyIntegration(Boolean(env.CLERK_SECRET_KEY), snap.integrations.clerk),
    calendly: classifyIntegration(Boolean(env.CALENDLY_CLIENT_ID && env.CALENDLY_CLIENT_SECRET), snap.integrations.calendly),
    twilio: classifyIntegration(Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN), snap.integrations.twilio),
    razorpay: classifyIntegration(Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET), snap.integrations.razorpay),
    agora: classifyIntegration(Boolean(env.AGORA_APP_ID && env.AGORA_APP_CERTIFICATE), snap.integrations.agora),
    abdm: classifyIntegration(abdmCfg.isExternalConnectivityReady, snap.integrations.abdm),
  };
};

export const getReadiness = () => {
  const database = isDatabaseReady() ? 'up' : 'down';
  return {
    ready: database === 'up',
    status: database === 'up' ? 'ready' : 'unavailable',
    checks: { database },
    timestamp: new Date().toISOString(),
  };
};
