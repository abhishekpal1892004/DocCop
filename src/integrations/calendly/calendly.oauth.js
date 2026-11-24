import crypto from 'node:crypto';
import axios from 'axios';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';

export const CALENDLY_OAUTH_SCOPES = Object.freeze([
  'users:read',
  'event_types:read',
  'availability:read',
  'scheduled_events:read',
  'scheduled_events:write',
  'webhooks:write',
]);

const getOAuthConfig = () => {
  const clientId = process.env.CALENDLY_CLIENT_ID || env.CALENDLY_CLIENT_ID;
  const clientSecret = process.env.CALENDLY_CLIENT_SECRET || env.CALENDLY_CLIENT_SECRET;
  const redirectUri = process.env.CALENDLY_REDIRECT_URI || env.CALENDLY_REDIRECT_URI;
  if (!clientId || !clientSecret) {
    throw new ApiError(503, 'Calendly OAuth credentials are not configured', 'CALENDLY_NOT_CONFIGURED');
  }
  return { clientId, clientSecret, redirectUri };
};

export const calendlyOAuth = {
  generateState() {
    return crypto.randomBytes(32).toString('base64url');
  },

  generatePkcePair() {
    const codeVerifier = crypto.randomBytes(48).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    return { codeVerifier, codeChallenge, method: 'S256' };
  },

  buildAuthorizationUrl({ state, codeChallenge }) {
    const { clientId, redirectUri } = getOAuthConfig();
    const url = new URL('/oauth/authorize', env.CALENDLY_AUTH_BASE_URL);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('scope', CALENDLY_OAUTH_SCOPES.join(' '));
    return url.toString();
  },

  async exchangeCodeForTokens({ code, codeVerifier }) {
    const { clientId, clientSecret, redirectUri } = getOAuthConfig();
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    });
    const res = await axios.post(`${env.CALENDLY_AUTH_BASE_URL}/oauth/token`, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      timeout: env.CALENDLY_TIMEOUT_MS,
      validateStatus: () => true,
    });
    if (res.status < 200 || res.status >= 300 || !res.data?.access_token) {
      throw new ApiError(502, 'Failed to exchange Calendly authorization code', 'CALENDLY_OAUTH_ERROR');
    }
    return res.data;
  },

  async refreshAccessToken(refreshToken) {
    const { clientId, clientSecret } = getOAuthConfig();
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    });
    const res = await axios.post(`${env.CALENDLY_AUTH_BASE_URL}/oauth/token`, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      timeout: env.CALENDLY_TIMEOUT_MS,
      validateStatus: () => true,
    });
    if (res.status < 200 || res.status >= 300 || !res.data?.access_token) {
      throw new ApiError(401, 'Calendly authorization expired; please reconnect your account', 'CALENDLY_REAUTH_REQUIRED');
    }
    return res.data;
  },
};
