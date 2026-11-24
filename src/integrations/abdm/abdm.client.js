import axios from 'axios';
import { ApiError } from '../../utils/ApiError.js';
import { abdmAuth } from './abdm.auth.js';
import { getAbdmRuntimeConfig } from './abdm.config.js';

const assertExternalReady = () => {
  const cfg = getAbdmRuntimeConfig();
  if (!cfg.enabled) {
    throw new ApiError(503, 'External ABDM connectivity is disabled (ABDM_ENABLED=false)', 'ABDM_EXTERNAL_DISABLED');
  }
  if (!cfg.hasCredentials) {
    throw new ApiError(503, 'ABDM credentials are not configured', 'ABDM_NOT_CONFIGURED');
  }
  return cfg;
};

export const abdmClient = {
  async requestGateway({ method = 'POST', path, data, headers = {}, base = 'gateway' }) {
    const cfg = assertExternalReady();
    const token = await abdmAuth.getAccessToken();
    const rootUrl = base === 'abha' ? cfg.abhaBaseUrl : cfg.baseUrl;

    const response = await axios({
      method,
      url: `${rootUrl}${path}`,
      data,
      headers: abdmAuth.buildGatewayHeaders(cfg, {
        Authorization: `Bearer ${token}`,
        ...(cfg.facilityId ? { 'X-HIP-ID': cfg.facilityId, 'X-HIU-ID': cfg.facilityId } : {}),
        ...headers,
      }),
      timeout: cfg.timeoutMs,
    });
    return response.data;
  },

  initiateAbhaVerification(payload) {
    return this.requestGateway({
      base: 'abha',
      method: 'POST',
      path: '/abha/api/v3/profile/login/request/otp',
      data: payload,
    });
  },

  verifyAbhaOtp(payload) {
    return this.requestGateway({
      base: 'abha',
      method: 'POST',
      path: '/abha/api/v3/profile/login/verify',
      data: payload,
    });
  },

  lookupHprProfile(hprId) {
    return this.requestGateway({
      method: 'POST',
      path: '/api/hiecm/hpr/v3/search',
      data: { hprId },
    });
  },

  lookupHfrFacility(hfrId) {
    return this.requestGateway({
      method: 'POST',
      path: '/api/hiecm/hfr/v3/search',
      data: { facilityId: hfrId },
    });
  },

  hipLinkCareContext(payload) {
    return this.requestGateway({
      method: 'POST',
      path: '/api/hiecm/hip/v3/link/carecontext',
      data: payload,
    });
  },

  hipNotifyContext(payload) {
    return this.requestGateway({
      method: 'POST',
      path: '/api/hiecm/hip/v3/link/context/notify',
      data: payload,
    });
  },

  hiuDiscoverCareContexts(payload) {
    return this.requestGateway({
      method: 'POST',
      path: '/api/hiecm/hiu/v3/care-contexts/discover',
      data: payload,
    });
  },

  hiuInitConsentRequest(payload) {
    return this.requestGateway({
      method: 'POST',
      path: '/api/hiecm/consent/v3/requests/init',
      data: payload,
    });
  },

  hiuRequestHealthInformation(payload) {
    return this.requestGateway({
      method: 'POST',
      path: '/api/hiecm/cm/v3/health-information/request',
      data: payload,
    });
  },

  hiuRevokeConsent(payload) {
    return this.requestGateway({
      method: 'POST',
      path: '/api/hiecm/consent/v3/revoke',
      data: payload,
    });
  },
};
