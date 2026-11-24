const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export class ApiClientError extends Error {
  constructor(message, { status = 500, code = 'API_ERROR', details = null } = {}) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function apiRequest(path, { method = 'GET', body, token, isFormData = false, signal } = {}) {
  const headers = {};
  if (!isFormData && body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiClientError('Unable to reach DocCop servers. Check your connection and try again.', {
      status: 0,
      code: 'NETWORK_ERROR',
    });
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/pdf') || contentType.includes('application/octet-stream')) {
    if (!response.ok) {
      throw new ApiClientError('Unable to download file.', { status: response.status });
    }
    return response.blob();
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || payload?.success === false) {
    const message =
      payload?.message ||
      (response.status === 401
        ? 'Your session has expired. Please sign in again.'
        : response.status === 403
          ? 'You do not have permission to perform this action.'
          : response.status >= 500
            ? 'A server error occurred. Please try again shortly.'
            : 'Request could not be completed.');
    throw new ApiClientError(message, {
      status: response.status,
      code: payload?.code || 'REQUEST_FAILED',
      details: payload?.details || null,
    });
  }

  return payload;
}

export function buildQuery(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      qs.set(key, String(value));
    }
  });
  const str = qs.toString();
  return str ? `?${str}` : '';
}
