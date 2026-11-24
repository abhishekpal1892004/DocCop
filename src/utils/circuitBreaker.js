import { ApiError } from './ApiError.js';
import { metrics } from './metrics.js';

const breakers = new Map();

export const withCircuitBreaker = async (
  provider,
  fn,
  { failureThreshold = 5, resetTimeoutMs = 30000 } = {}
) => {
  const state = breakers.get(provider) || { failures: 0, openedAt: null };
  if (state.openedAt && Date.now() - state.openedAt < resetTimeoutMs) {
    throw new ApiError(503, `${provider} is temporarily unavailable (circuit open)`, 'PROVIDER_CIRCUIT_OPEN');
  }

  try {
    const result = await fn();
    breakers.set(provider, { failures: 0, openedAt: null });
    metrics.recordIntegrationCall(provider, true);
    return result;
  } catch (err) {
    const failures = state.failures + 1;
    const openedAt = failures >= failureThreshold ? Date.now() : null;
    breakers.set(provider, { failures, openedAt });
    metrics.recordIntegrationCall(provider, false);
    throw err;
  }
};

export const getCircuitBreakerStates = () => {
  const out = {};
  for (const [provider, state] of breakers.entries()) {
    out[provider] = {
      status: state.openedAt ? 'OPEN' : 'CLOSED',
      consecutiveFailures: state.failures,
      openedAt: state.openedAt ? new Date(state.openedAt).toISOString() : null,
    };
  }
  return out;
};
