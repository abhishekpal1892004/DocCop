const MAX_LATENCY_SAMPLES = 1000;

const state = {
  startedAt: Date.now(),
  httpRequestsTotal: 0,
  httpErrorsTotal: 0,
  statusDistribution: {},
  routeStats: new Map(),
  latencySamples: [],
  dbLatencies: [],
  worker: {
    ticksTotal: 0,
    lastHeartbeatAt: null,
    lastDurationMs: null,
    lastError: null,
  },
  integrations: {
    clerk: { calls: 0, failures: 0, lastFailureAt: null },
    calendly: { calls: 0, failures: 0, lastFailureAt: null },
    twilio: { calls: 0, failures: 0, lastFailureAt: null },
    razorpay: { calls: 0, failures: 0, lastFailureAt: null },
    agora: { calls: 0, failures: 0, lastFailureAt: null },
    abdm: { calls: 0, failures: 0, lastFailureAt: null },
  },
  recentSystemErrors: [],
};

const pushBounded = (arr, val, max = MAX_LATENCY_SAMPLES) => {
  arr.push(val);
  if (arr.length > max) arr.shift();
};

const percentile = (sorted, p) => {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return Number(sorted[idx].toFixed(2));
};

export const metrics = {
  recordHttpRequest({ method, route, statusCode, durationMs }) {
    state.httpRequestsTotal += 1;
    if (statusCode >= 500) state.httpErrorsTotal += 1;
    const statusKey = String(statusCode);
    state.statusDistribution[statusKey] = (state.statusDistribution[statusKey] || 0) + 1;
    pushBounded(state.latencySamples, durationMs);

    const routeKey = `${method} ${route}`;
    const current = state.routeStats.get(routeKey) || { count: 0, errors: 0, totalMs: 0, maxMs: 0 };
    current.count += 1;
    if (statusCode >= 500) current.errors += 1;
    current.totalMs += durationMs;
    current.maxMs = Math.max(current.maxMs, durationMs);
    state.routeStats.set(routeKey, current);
  },

  recordDbLatency(durationMs) {
    pushBounded(state.dbLatencies, durationMs, 200);
  },

  recordWorkerTick({ durationMs, error = null }) {
    state.worker.ticksTotal += 1;
    state.worker.lastHeartbeatAt = new Date().toISOString();
    state.worker.lastDurationMs = durationMs;
    state.worker.lastError = error ? String(error) : null;
  },

  recordIntegrationCall(provider, ok = true) {
    const entry = state.integrations[provider];
    if (!entry) return;
    entry.calls += 1;
    if (!ok) {
      entry.failures += 1;
      entry.lastFailureAt = new Date().toISOString();
    }
  },

  recordSystemError({ code, message, route, correlationId }) {
    pushBounded(
      state.recentSystemErrors,
      {
        timestamp: new Date().toISOString(),
        code: code || 'INTERNAL_SERVER_ERROR',
        message: String(message || '').slice(0, 200),
        route: route || null,
        correlationId: correlationId || null,
      },
      50
    );
  },

  getSnapshot() {
    const sorted = [...state.latencySamples].sort((a, b) => a - b);
    const avgLatencyMs = sorted.length ? Number((sorted.reduce((a, b) => a + b, 0) / sorted.length).toFixed(2)) : 0;
    const dbSorted = [...state.dbLatencies].sort((a, b) => a - b);
    const mem = process.memoryUsage();
    const cpu = process.cpuUsage();

    return {
      uptimeSeconds: Math.floor((Date.now() - state.startedAt) / 1000),
      http: {
        requestsTotal: state.httpRequestsTotal,
        errorsTotal: state.httpErrorsTotal,
        errorRate: state.httpRequestsTotal ? Number((state.httpErrorsTotal / state.httpRequestsTotal).toFixed(4)) : 0,
        statusDistribution: { ...state.statusDistribution },
        latencyMs: {
          avg: avgLatencyMs,
          p50: percentile(sorted, 50),
          p95: percentile(sorted, 95),
          p99: percentile(sorted, 99),
        },
        topRoutes: [...state.routeStats.entries()]
          .map(([route, s]) => ({
            route,
            count: s.count,
            errors: s.errors,
            avgMs: Number((s.totalMs / s.count).toFixed(2)),
            maxMs: Number(s.maxMs.toFixed(2)),
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 15),
      },
      database: {
        avgQueryLatencyMs: dbSorted.length
          ? Number((dbSorted.reduce((a, b) => a + b, 0) / dbSorted.length).toFixed(2))
          : 0,
        p95QueryLatencyMs: percentile(dbSorted, 95),
      },
      process: {
        memoryRssMb: Number((mem.rss / 1048576).toFixed(2)),
        heapUsedMb: Number((mem.heapUsed / 1048576).toFixed(2)),
        cpuUserMs: Math.round(cpu.user / 1000),
        cpuSystemMs: Math.round(cpu.system / 1000),
      },
      worker: { ...state.worker },
      integrations: structuredClone(state.integrations),
      recentSystemErrors: [...state.recentSystemErrors],
    };
  },
};

export const metricsMiddleware = (req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const route = req.route?.path ? `${req.baseUrl || ''}${req.route.path}` : req.originalUrl?.split('?')[0] || '/';
    metrics.recordHttpRequest({
      method: req.method,
      route,
      statusCode: res.statusCode,
      durationMs,
    });
  });
  next();
};
