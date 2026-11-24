import crypto from 'node:crypto';
import axios from 'axios';
import { ApiError } from '../../utils/ApiError.js';
import { getAbdmRuntimeConfig } from './abdm.config.js';
import { abdmTokenService } from './abdm.token.service.js';

export const abdmAuth = {
  buildGatewayHeaders(cfg, extra = {}) {
    return {
      'Content-Type': 'application/json',
      'REQUEST-ID': crypto.randomUUID(),
      TIMESTAMP: new Date().toISOString(),
      'X-CM-ID': cfg.cmId,
      ...extra,
    };
  },

  async getAccessToken() {
    const cfg = getAbdmRuntimeConfig();
    if (!cfg.enabled) {
      throw new ApiError(503, 'ABDM integration is disabled (ABDM_ENABLED=false)', 'ABDM_EXTERNAL_DISABLED');
    }
    if (!cfg.hasCredentials) {
      throw new ApiError(503, 'ABDM sandbox/production credentials are not configured', 'ABDM_NOT_CONFIGURED');
    }

    const existing = abdmTokenService.getCachedToken();
    if (existing) return existing;

    const url = `${cfg.baseUrl}/api/hiecm/gateway/v3/sessions`;
    const response = await axios.post(
      url,
      {
        clientId: cfg.clientId,
        clientSecret: cfg.clientSecret,
        grantType: 'client_credentials',
      },
      {
        headers: this.buildGatewayHeaders(cfg),
        timeout: cfg.timeoutMs,
      }
    );

    const token = response?.data?.accessToken;
    if (!token) {
      throw new ApiError(502, 'ABDM gateway did not return an access token', 'ABDM_AUTH_FAILED');
    }
    abdmTokenService.setCachedToken(token, response.data.expiresIn || 1200);
    return token;
  },
};
