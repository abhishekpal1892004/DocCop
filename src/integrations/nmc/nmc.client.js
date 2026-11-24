import axios from 'axios';
import { env } from '../../config/env.js';
import { NMC_PAGE_SIZE, NMC_SEARCH_TYPE } from './nmc.constants.js';
import { mapNmcResponse } from './nmc.mapper.js';

/** Raised for every provider-side problem. `reason` is for server logs only, never for end users. */
export class NmcProviderError extends Error {
  constructor(reason, detail) {
    super(`NMC provider error: ${reason}`);
    this.name = 'NmcProviderError';
    this.reason = reason;
    this.detail = detail;
  }
}

/**
 * No cookies, XSRF tokens or other browser-session values are ever sent. If the provider starts
 * requiring official authorization, callers receive PROVIDER_UNAVAILABLE and fall back to manual review.
 */
export const createNmcClient = ({ httpClient, baseUrl = env.NMC_SEARCH_URL, timeoutMs = env.NMC_TIMEOUT_MS } = {}) => {
  const http = httpClient ?? axios.create();

  const search = async ({ name, registrationNumber, registrationYear, state }) => {
    let response;
    try {
      response = await http.get(baseUrl, {
        params: {
          search_type: NMC_SEARCH_TYPE,
          name,
          reg_no: registrationNumber,
          year: registrationYear,
          state,
          page: 1,
          per_page: NMC_PAGE_SIZE,
        },
        headers: { Accept: 'application/json' },
        timeout: timeoutMs,
        maxRedirects: 0,
        maxContentLength: 2 * 1024 * 1024,
        validateStatus: () => true,
        responseType: 'text', // parse ourselves so malformed JSON is handled explicitly
        transformResponse: (data) => data,
      });
    } catch (err) {
      const reason = err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT' ? 'TIMEOUT' : `NETWORK_${err.code ?? 'ERROR'}`;
      throw new NmcProviderError(reason, err.message);
    }

    const { status } = response;
    if ([401, 403, 419].includes(status)) throw new NmcProviderError('ACCESS_DENIED', `HTTP ${status}`);
    if (status === 429) throw new NmcProviderError('RATE_LIMITED', 'HTTP 429');
    if (status >= 500) throw new NmcProviderError('UPSTREAM_ERROR', `HTTP ${status}`);
    if (status < 200 || status >= 300) throw new NmcProviderError('UNEXPECTED_STATUS', `HTTP ${status}`);

    const contentType = String(response.headers?.['content-type'] ?? '');
    if (!/application\/json/i.test(contentType)) throw new NmcProviderError('NOT_JSON', `content-type: ${contentType}`);

    let body;
    try {
      body = JSON.parse(response.data);
    } catch {
      throw new NmcProviderError('INVALID_JSON');
    }

    const mapped = mapNmcResponse(body);
    if (!mapped) throw new NmcProviderError('UNEXPECTED_SCHEMA');
    return mapped;
  };

  return { search };
};

export const nmcClient = createNmcClient();
