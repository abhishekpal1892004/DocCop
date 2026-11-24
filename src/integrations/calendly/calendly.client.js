import axios from 'axios';
import { env } from '../../config/env.js';

export class CalendlyProviderError extends Error {
  constructor(message, { statusCode = 502, code = 'CALENDLY_PROVIDER_ERROR', isTimeout = false } = {}) {
    super(message);
    this.name = 'CalendlyProviderError';
    this.statusCode = statusCode;
    this.code = code;
    this.isTimeout = isTimeout;
  }
}

export const extractCalendlyUuid = (uri) => String(uri ?? '').split('/').filter(Boolean).pop() ?? '';

export const createCalendlyClient = ({ httpClient, baseUrl = env.CALENDLY_API_BASE_URL, timeoutMs = env.CALENDLY_TIMEOUT_MS } = {}) => {
  const http = httpClient ?? axios.create();

  const request = async (method, path, { accessToken, params, data } = {}) => {
    let response;
    try {
      response = await http.request({
        method,
        url: path.startsWith('http') ? path : `${baseUrl}${path}`,
        params,
        data,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
          ...(data ? { 'Content-Type': 'application/json' } : {}),
        },
        timeout: timeoutMs,
        validateStatus: () => true,
      });
    } catch (err) {
      const isTimeout = err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT';
      throw new CalendlyProviderError(
        isTimeout ? 'Calendly request timed out' : 'Unable to reach Calendly',
        { statusCode: isTimeout ? 504 : 502, code: isTimeout ? 'CALENDLY_TIMEOUT' : 'CALENDLY_NETWORK_ERROR', isTimeout }
      );
    }

    if (response.status >= 200 && response.status < 300) {
      return response.data;
    }

    if (response.status === 401) {
      throw new CalendlyProviderError('Calendly access token is invalid or revoked', {
        statusCode: 401,
        code: 'CALENDLY_UNAUTHORIZED',
      });
    }

    if (response.status === 409 || response.status === 422) {
      throw new CalendlyProviderError(
        response.data?.message || 'Selected time slot is no longer available',
        { statusCode: 409, code: 'SLOT_UNAVAILABLE' }
      );
    }

    throw new CalendlyProviderError(
      response.data?.message || `Calendly returned HTTP ${response.status}`,
      { statusCode: 502, code: 'CALENDLY_PROVIDER_ERROR' }
    );
  };

  return {
    getCurrentUser: (accessToken) => request('GET', '/users/me', { accessToken }),

    listEventTypes: (accessToken, userUri) =>
      request('GET', '/event_types', {
        accessToken,
        params: { user: userUri, active: true, count: 50 },
      }),

    listEventTypeAvailableTimes: (accessToken, { eventTypeUri, startTime, endTime }) =>
      request('GET', '/event_type_available_times', {
        accessToken,
        params: { event_type: eventTypeUri, start_time: startTime, end_time: endTime },
      }),

    createInvitee: (accessToken, payload) => request('POST', '/invitees', { accessToken, data: payload }),

    cancelScheduledEvent: (accessToken, eventUri, reason) => {
      const uuid = extractCalendlyUuid(eventUri);
      return request('POST', `/scheduled_events/${uuid}/cancellation`, {
        accessToken,
        data: { reason },
      });
    },

    listScheduledEvents: (accessToken, { userUri, minStartTime, maxStartTime }) =>
      request('GET', '/scheduled_events', {
        accessToken,
        params: {
          user: userUri,
          min_start_time: minStartTime,
          max_start_time: maxStartTime,
          count: 50,
        },
      }),

    createWebhookSubscription: (accessToken, { url, events, organizationUri, userUri, signingKey, scope = 'user' }) =>
      request('POST', '/webhook_subscriptions', {
        accessToken,
        data: {
          url,
          events,
          organization: organizationUri,
          user: userUri,
          scope,
          ...(signingKey ? { signing_key: signingKey } : {}),
        },
      }),

    deleteWebhookSubscription: (accessToken, webhookUri) => {
      const uuid = extractCalendlyUuid(webhookUri);
      return request('DELETE', `/webhook_subscriptions/${uuid}`, { accessToken });
    },
  };
};

export const calendlyClient = createCalendlyClient();
