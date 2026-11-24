import { env } from '../../config/env.js';

export const parseIntegrationRoles = (raw) =>
  String(raw ?? '')
    .split(',')
    .map((r) => r.trim().toUpperCase())
    .filter((r) => r === 'HIP' || r === 'HIU');

export const getAbdmRuntimeConfig = () => {
  const enabled = String(process.env.ABDM_ENABLED ?? env.ABDM_ENABLED) === 'true';
  const environment = process.env.ABDM_ENVIRONMENT || env.ABDM_ENVIRONMENT || 'SANDBOX';
  const clientId = process.env.ABDM_CLIENT_ID ?? env.ABDM_CLIENT_ID ?? '';
  const clientSecret = process.env.ABDM_CLIENT_SECRET ?? env.ABDM_CLIENT_SECRET ?? '';
  const baseUrl = (process.env.ABDM_BASE_URL || env.ABDM_BASE_URL || 'https://dev.abdm.gov.in').replace(/\/+$/, '');
  const abhaBaseUrl = (process.env.ABDM_ABHA_BASE_URL || env.ABDM_ABHA_BASE_URL || 'https://abhasbx.abdm.gov.in').replace(
    /\/+$/,
    ''
  );
  const cmId = process.env.ABDM_CM_ID || env.ABDM_CM_ID || (environment === 'SANDBOX' ? 'sbx' : 'abdm');
  const callbackBaseUrl = (process.env.ABDM_CALLBACK_BASE_URL ?? env.ABDM_CALLBACK_BASE_URL ?? '').replace(/\/+$/, '');
  const facilityId = process.env.ABDM_FACILITY_ID ?? env.ABDM_FACILITY_ID ?? '';
  const integrationRoles = parseIntegrationRoles(process.env.ABDM_INTEGRATION_ROLE ?? env.ABDM_INTEGRATION_ROLE);
  const timeoutMs = Number(process.env.ABDM_REQUEST_TIMEOUT_MS || env.ABDM_REQUEST_TIMEOUT_MS || 15000);
  const hasCredentials = Boolean(clientId && clientSecret);

  return {
    enabled,
    environment,
    clientId,
    clientSecret,
    baseUrl,
    abhaBaseUrl,
    cmId,
    callbackBaseUrl,
    facilityId,
    integrationRoles,
    timeoutMs,
    hasCredentials,
    isExternalConnectivityReady: enabled && hasCredentials,
  };
};
