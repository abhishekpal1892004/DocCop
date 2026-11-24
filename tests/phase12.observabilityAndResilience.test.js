import { signSessionToken } from './setup.js';
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createFakeUserRepository } from './helpers/fakeUserRepository.js';
import { redactSensitive } from '../src/utils/logger.js';
import { errorTracker } from '../src/utils/errorTracker.js';
import { withCircuitBreaker } from '../src/utils/circuitBreaker.js';

const { default: app } = await import('../src/app.js');
const { userRepository } = await import('../src/modules/users/user.repository.js');
const { clerkGateway } = await import('../src/integrations/clerk/clerk.gateway.js');

const bearer = (id) => ({ Authorization: `Bearer ${signSessionToken(id)}` });

let fakeUsers;
let origUserRepo;

beforeEach(() => {
  process.env.METRICS_AUTH_TOKEN = 'test-metrics-secret';
  fakeUsers = createFakeUserRepository();
  origUserRepo = { ...userRepository };
  Object.assign(userRepository, fakeUsers.repo);
  mock.method(clerkGateway, 'getUser', async (id) => ({
    id,
    emailAddresses: [{ emailAddress: `${id}@test.local` }],
    firstName: 'Test',
    lastName: 'User',
  }));
});

afterEach(() => {
  Object.assign(userRepository, origUserRepo);
  delete process.env.METRICS_AUTH_TOKEN;
  mock.restoreAll();
});

describe('Phase 12 - Observability, Redaction, Circuit Breaker & Admin System Health', () => {
  it('redacts sensitive tokens and clinical/ABHA fields in logs and error tracker', async () => {
    const clean = redactSensitive({
      authorization: 'Bearer secret-jwt',
      abhaNumber: '91-1234-5678-9012',
      diagnosis: 'Hypertension',
      route: '/api/v1/health/live',
    });
    assert.equal(clean.authorization, '[REDACTED]');
    assert.equal(clean.abhaNumber, '[REDACTED]');
    assert.equal(clean.diagnosis, '[REDACTED]');
    assert.equal(clean.route, '/api/v1/health/live');

    const tracked = await errorTracker.captureException(new Error('Provider timeout'), {
      correlationId: 'corr-1',
      route: '/api/v1/test',
    });
    assert.equal(tracked.sent, false);
    assert.equal(tracked.reason, 'disabled');
  });

  it('trips circuit breaker after consecutive provider failures', async () => {
    const provider = `test-prov-${Date.now()}`;
    for (let i = 0; i < 3; i += 1) {
      await assert.rejects(() =>
        withCircuitBreaker(
          provider,
          async () => {
            throw new Error('upstream down');
          },
          { failureThreshold: 3, resetTimeoutMs: 5000 }
        )
      );
    }
    await assert.rejects(
      () => withCircuitBreaker(provider, async () => 'ok', { failureThreshold: 3, resetTimeoutMs: 5000 }),
      (err) => err.statusCode === 503 && err.code === 'PROVIDER_CIRCUIT_OPEN'
    );
  });

  it('protects /health/metrics and /admin/system-health with strict authorization', async () => {
    const pat = await fakeUsers.repo.create({
      clerkUserId: 'clerk_p12_pat',
      email: 'p12pat@test.local',
      role: 'PATIENT',
      accountStatus: 'ACTIVE',
      onboardingStatus: 'COMPLETED',
    });
    const admin = await fakeUsers.repo.create({
      clerkUserId: 'clerk_p12_admin',
      email: 'p12admin@test.local',
      role: 'ADMIN',
      accountStatus: 'ACTIVE',
      onboardingStatus: 'COMPLETED',
    });

    const unauthMetrics = await request(app).get('/api/v1/health/metrics');
    assert.equal(unauthMetrics.status, 401);

    const authMetrics = await request(app)
      .get('/api/v1/health/metrics')
      .set('x-metrics-token', 'test-metrics-secret');
    assert.equal(authMetrics.status, 200);
    assert.ok(typeof authMetrics.body.data.http.requestsTotal === 'number');
    assert.ok(authMetrics.body.data.integrationHealth);

    const patSysRes = await request(app).get('/api/v1/admin/system-health').set(bearer(pat.clerkUserId));
    assert.equal(patSysRes.status, 403);

    const adminSysRes = await request(app).get('/api/v1/admin/system-health').set(bearer(admin.clerkUserId));
    assert.equal(adminSysRes.status, 200);
    assert.ok(adminSysRes.body.data.application);
    assert.ok(adminSysRes.body.data.worker);
    assert.ok(adminSysRes.body.data.integrations);
  });
});
