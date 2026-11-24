import { signSessionToken, signWebhook } from './setup.js';
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { generateKeyPairSync } from 'node:crypto';
import { createFakeUserRepository } from './helpers/fakeUserRepository.js';

const { default: app } = await import('../src/app.js');
const { userRepository } = await import('../src/modules/users/user.repository.js');
const { clerkGateway } = await import('../src/integrations/clerk/clerk.gateway.js');
const { clerkAuth, requireAuth, requireRole, requireActiveAccount } = await import('../src/middleware/auth.middleware.js');
const { errorHandler } = await import('../src/middleware/error.middleware.js');
const { provisionAdmin } = await import('../src/modules/users/user.service.js');

const clerkUser = (id, overrides = {}) => ({
  id,
  firstName: 'Asha',
  lastName: 'Rao',
  imageUrl: 'https://img.example/a.png',
  primaryEmailAddressId: 'idn_1',
  emailAddresses: [{ id: 'idn_1', emailAddress: `${id}@Example.com`, verification: { status: 'verified' } }],
  phoneNumbers: [],
  updatedAt: 1000,
  ...overrides,
});

let fake;
let originals;
const bearer = (id) => ({ Authorization: `Bearer ${signSessionToken(id)}` });

beforeEach(() => {
  fake = createFakeUserRepository();
  originals = { ...userRepository };
  Object.assign(userRepository, fake.repo);
  mock.method(clerkGateway, 'getUser', async (id) => clerkUser(id));
});
afterEach(() => {
  Object.assign(userRepository, originals);
  mock.restoreAll();
});

const onboard = (id, body) => request(app).post('/api/v1/users/onboard').set(bearer(id)).send(body);

describe('Authentication', () => {
  it('rejects requests without a token with 401', async () => {
    const res = await request(app).get('/api/v1/users/me');
    assert.equal(res.status, 401);
    assert.equal(res.body.code, 'UNAUTHENTICATED');
  });

  it('rejects garbage tokens', async () => {
    const res = await request(app).get('/api/v1/users/me').set('Authorization', 'Bearer not.a.jwt');
    assert.equal(res.status, 401);
  });

  it('rejects tokens signed with a different key', async () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const token = signSessionToken('user_a', { key: privateKey });
    const res = await request(app).get('/api/v1/users/me').set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 401);
  });

  it('rejects expired tokens', async () => {
    const token = signSessionToken('user_a', { expiresInSec: -600 });
    const res = await request(app).get('/api/v1/users/me').set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 401);
  });

  it('lets a valid session reach protected endpoints', async () => {
    const res = await request(app).get('/api/v1/users/me').set(bearer('user_a'));
    // Authenticated, but no MongoDB profile yet.
    assert.equal(res.status, 404);
    assert.equal(res.body.code, 'ONBOARDING_REQUIRED');
  });

  it('keeps health endpoints public', async () => {
    const res = await request(app).get('/api/v1/health/live');
    assert.equal(res.status, 200);
  });
});

describe('POST /users/onboard', () => {
  it('requires authentication', async () => {
    const res = await request(app).post('/api/v1/users/onboard').send({ accountType: 'PATIENT' });
    assert.equal(res.status, 401);
  });

  it('creates a PATIENT account with identity from Clerk', async () => {
    const res = await onboard('user_p1', { accountType: 'PATIENT' });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.user.role, 'PATIENT');
    assert.equal(res.body.data.user.accountStatus, 'ACTIVE');
    assert.equal(res.body.data.user.onboardingStatus, 'NOT_STARTED');
    assert.equal(res.body.data.user.email, 'user_p1@example.com'); // normalized
    assert.equal(res.body.data.user.isEmailVerified, true);
    assert.equal(res.body.data.user.fullName, 'Asha Rao');
  });

  it('creates a DOCTOR account that is not verified or approved', async () => {
    const res = await onboard('user_d1', { accountType: 'doctor' });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.user.role, 'DOCTOR');
    assert.equal(res.body.data.user.onboardingStatus, 'NOT_STARTED');
    assert.notEqual(res.body.data.user.onboardingStatus, 'APPROVED');
  });

  it('is idempotent: repeated onboarding creates one record', async () => {
    const first = await onboard('user_p1', { accountType: 'PATIENT' });
    const second = await onboard('user_p1', { accountType: 'PATIENT' });
    assert.equal(first.status, 201);
    assert.equal(second.status, 200);
    assert.equal(second.body.data.created, false);
    assert.equal(fake.store.size, 1);
    assert.equal(fake.calls.create, 1);
  });

  it('handles a concurrent duplicate-key race idempotently', async () => {
    let first = true;
    userRepository.findByClerkUserId = async (id) => {
      if (first) { first = false; return null; } // simulate: not found, then created by a concurrent request
      return fake.repo.findByClerkUserId(id);
    };
    await fake.repo.create({ clerkUserId: 'user_r', email: 'r@x.com', role: 'PATIENT', accountStatus: 'ACTIVE' });
    const res = await onboard('user_r', { accountType: 'PATIENT' });
    assert.equal(res.status, 200);
  });

  it('rejects changing the role via onboarding with 409', async () => {
    await onboard('user_p1', { accountType: 'PATIENT' });
    const res = await onboard('user_p1', { accountType: 'DOCTOR' });
    assert.equal(res.status, 409);
    assert.equal(res.body.code, 'ROLE_CONFLICT');
    assert.equal(fake.store.get('user_p1').role, 'PATIENT');
  });

  it('cannot create an ADMIN through public onboarding', async () => {
    for (const accountType of ['ADMIN', 'admin']) {
      const res = await onboard('user_x', { accountType });
      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'VALIDATION_ERROR');
    }
    assert.equal(fake.store.size, 0);
  });

  it('cannot onboard an existing ADMIN as another role', async () => {
    await provisionAdmin('user_admin');
    const res = await onboard('user_admin', { accountType: 'PATIENT' });
    assert.equal(res.status, 409);
  });

  it('rejects missing or invalid accountType', async () => {
    assert.equal((await onboard('user_x', {})).status, 400);
    assert.equal((await onboard('user_x', { accountType: 'NURSE' })).status, 400);
  });

  it('ignores client-supplied identity, role and status fields', async () => {
    const res = await onboard('user_real', {
      accountType: 'PATIENT',
      clerkUserId: 'user_evil',
      email: 'evil@example.com',
      role: 'ADMIN',
      accountStatus: 'SUSPENDED',
      isEmailVerified: false,
    });
    assert.equal(res.status, 201);
    assert.ok(fake.store.has('user_real'));
    assert.ok(!fake.store.has('user_evil'));
    const doc = fake.store.get('user_real');
    assert.equal(doc.role, 'PATIENT');
    assert.equal(doc.accountStatus, 'ACTIVE');
    assert.equal(doc.email, 'user_real@example.com');
    assert.equal(doc.isEmailVerified, true);
  });

  it('returns 404 when Clerk does not know the user, 502 when Clerk is down', async () => {
    mock.method(clerkGateway, 'getUser', async () => { throw Object.assign(new Error('nf'), { status: 404 }); });
    assert.equal((await onboard('user_a', { accountType: 'PATIENT' })).status, 404);
    mock.method(clerkGateway, 'getUser', async () => { throw new Error('network'); });
    const res = await onboard('user_a', { accountType: 'PATIENT' });
    assert.equal(res.status, 502);
    assert.equal(res.body.code, 'IDENTITY_PROVIDER_ERROR');
  });
});

describe('GET/PATCH /users/me', () => {
  beforeEach(async () => {
    await onboard('user_a', { accountType: 'PATIENT' });
    mock.method(clerkGateway, 'getUser', async (id) => clerkUser(id, { firstName: 'Bela', lastName: 'Nair' }));
    await onboard('user_b', { accountType: 'DOCTOR' });
  });

  it('returns only the caller own profile, without internals', async () => {
    const a = await request(app).get('/api/v1/users/me').set(bearer('user_a'));
    const b = await request(app).get('/api/v1/users/me').set(bearer('user_b'));
    assert.equal(a.status, 200);
    assert.equal(a.body.data.user.email, 'user_a@example.com');
    assert.equal(a.body.data.user.role, 'PATIENT');
    assert.equal(b.body.data.user.email, 'user_b@example.com');
    assert.equal(b.body.data.user.role, 'DOCTOR');
    for (const key of ['clerkUserId', 'clerkUpdatedAt', 'deletedAt', '_id']) {
      assert.ok(!(key in a.body.data.user), `${key} must not be exposed`);
    }
  });

  it('does not allow selecting another user via query/params', async () => {
    const res = await request(app).get('/api/v1/users/me?clerkUserId=user_b').set(bearer('user_a'));
    assert.equal(res.body.data.user.email, 'user_a@example.com');
  });

  it('updates permitted fields', async () => {
    const res = await request(app)
      .patch('/api/v1/users/me')
      .set(bearer('user_a'))
      .send({ firstName: 'Meera', phoneNumber: '+919876543210', preferences: { language: 'hi' } });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.firstName, 'Meera');
    assert.equal(res.body.data.user.fullName, 'Meera Rao');
    assert.equal(res.body.data.user.phoneNumber, '+919876543210');
    assert.equal(res.body.data.user.preferences.language, 'hi');
    assert.equal(fake.store.get('user_b').firstName, 'Bela'); // other user untouched
  });

  it('rejects attempts to change role, accountStatus or other protected fields', async () => {
    for (const body of [
      { role: 'ADMIN' },
      { accountStatus: 'ACTIVE' },
      { onboardingStatus: 'APPROVED' },
      { isEmailVerified: true },
      { clerkUserId: 'user_b' },
      { firstName: 'X', role: 'ADMIN' },
    ]) {
      const res = await request(app).patch('/api/v1/users/me').set(bearer('user_a')).send(body);
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.equal(res.body.code, 'VALIDATION_ERROR');
    }
    assert.equal(fake.store.get('user_a').role, 'PATIENT');
    assert.equal(fake.calls.updateProfile, 0);
  });

  it('rejects invalid values and empty bodies', async () => {
    assert.equal((await request(app).patch('/api/v1/users/me').set(bearer('user_a')).send({ phoneNumber: '123' })).status, 400);
    assert.equal((await request(app).patch('/api/v1/users/me').set(bearer('user_a')).send({})).status, 400);
  });

  it('blocks suspended users from updating but lets them read /me', async () => {
    fake.store.get('user_a').accountStatus = 'SUSPENDED';
    const patch = await request(app).patch('/api/v1/users/me').set(bearer('user_a')).send({ firstName: 'Z' });
    assert.equal(patch.status, 403);
    assert.equal(patch.body.code, 'ACCOUNT_SUSPENDED');
    const get = await request(app).get('/api/v1/users/me').set(bearer('user_a'));
    assert.equal(get.status, 200);
    assert.equal(get.body.data.user.accountStatus, 'SUSPENDED');
  });

  it('handles a missing MongoDB profile on PATCH', async () => {
    const res = await request(app).patch('/api/v1/users/me').set(bearer('user_unknown')).send({ firstName: 'Z' });
    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'ONBOARDING_REQUIRED');
  });
});

describe('RBAC middleware', () => {
  let rbacApp;
  beforeEach(async () => {
    rbacApp = express();
    rbacApp.use(clerkAuth);
    rbacApp.get('/admin-only', requireAuth, requireRole('ADMIN'), (req, res) => res.json({ role: req.currentUser.role }));
    rbacApp.get('/any-active', requireAuth, requireActiveAccount, (_req, res) => res.json({ ok: true }));
    rbacApp.use(errorHandler);

    await onboard('user_patient', { accountType: 'PATIENT' });
    await onboard('user_doctor', { accountType: 'DOCTOR' });
    await provisionAdmin('user_admin');
  });

  const get = (path, id) => {
    const r = request(rbacApp).get(path);
    return id ? r.set(bearer(id)) : r;
  };

  it('returns 401 for unauthenticated requests', async () => {
    const res = await get('/admin-only');
    assert.equal(res.status, 401);
  });

  it('returns 403 for PATIENT and DOCTOR on ADMIN routes', async () => {
    for (const id of ['user_patient', 'user_doctor']) {
      const res = await get('/admin-only', id);
      assert.equal(res.status, 403);
      assert.equal(res.body.code, 'INSUFFICIENT_ROLE');
    }
  });

  it('allows ADMIN (role read from MongoDB)', async () => {
    const res = await get('/admin-only', 'user_admin');
    assert.equal(res.status, 200);
    assert.equal(res.body.role, 'ADMIN');
  });

  it('ignores a client-supplied role header/body', async () => {
    const res = await request(rbacApp).get('/admin-only').set(bearer('user_patient')).set('X-Role', 'ADMIN').query({ role: 'ADMIN' });
    assert.equal(res.status, 403);
  });

  it('rejects suspended and deactivated users', async () => {
    fake.store.get('user_admin').accountStatus = 'SUSPENDED';
    assert.equal((await get('/admin-only', 'user_admin')).body.code, 'ACCOUNT_SUSPENDED');
    fake.store.get('user_patient').accountStatus = 'DEACTIVATED';
    const res = await get('/any-active', 'user_patient');
    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'ACCOUNT_DEACTIVATED');
  });

  it('rejects authenticated users without a MongoDB profile', async () => {
    const res = await get('/any-active', 'user_nobody');
    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'ONBOARDING_REQUIRED');
  });
});

describe('POST /webhooks/clerk', () => {
  const event = (type, data) => JSON.stringify({ type, data, object: 'event' });
  const post = (body, headers) => request(app).post('/api/v1/webhooks/clerk').set(headers).send(body);
  const updatedPayload = (id, email, updatedAt) => ({
    id,
    email_addresses: [{ id: 'idn_9', email_address: email, verification: { status: 'verified' } }],
    primary_email_address_id: 'idn_9',
    image_url: 'https://img.example/new.png',
    updated_at: updatedAt,
  });

  beforeEach(async () => {
    await onboard('user_w', { accountType: 'DOCTOR' }); // clerkUpdatedAt = 1000
  });

  it('rejects missing and invalid signatures', async () => {
    const body = event('user.updated', updatedPayload('user_w', 'x@example.com', 5000));
    const noSig = await request(app).post('/api/v1/webhooks/clerk').set('content-type', 'application/json').send(body);
    assert.equal(noSig.status, 400);
    assert.equal(noSig.body.code, 'INVALID_WEBHOOK_SIGNATURE');

    const wrongSecret = await post(body, signWebhook(body, { secret: 'some-other-secret' }));
    assert.equal(wrongSecret.status, 400);

    const tampered = await post(body.replace('x@example', 'y@example'), signWebhook(body));
    assert.equal(tampered.status, 400);
    assert.equal(fake.calls.syncIdentity, 0);
  });

  it('rejects stale timestamps (replay)', async () => {
    const body = event('user.updated', updatedPayload('user_w', 'x@example.com', 5000));
    const res = await post(body, signWebhook(body, { timestamp: Math.floor(Date.now() / 1000) - 3600 }));
    assert.equal(res.status, 400);
  });

  it('accepts a valid user.updated and never changes the role', async () => {
    const body = event('user.updated', updatedPayload('user_w', 'New@Example.com', 5000));
    const res = await post(body, signWebhook(body));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.outcome, 'updated');
    const doc = fake.store.get('user_w');
    assert.equal(doc.email, 'new@example.com');
    assert.equal(doc.role, 'DOCTOR');
    assert.equal(doc.accountStatus, 'ACTIVE');
    assert.equal(doc.onboardingStatus, 'NOT_STARTED');
  });

  it('applies a duplicate event only once', async () => {
    const body = event('user.updated', updatedPayload('user_w', 'dup@example.com', 6000));
    const headers = signWebhook(body);
    const first = await post(body, headers);
    const second = await post(body, headers);
    assert.equal(first.body.data.outcome, 'updated');
    assert.equal(second.status, 200);
    assert.equal(second.body.data.outcome, 'skipped_stale_or_unknown');
  });

  it('ignores out-of-order (older) events', async () => {
    const newer = event('user.updated', updatedPayload('user_w', 'newer@example.com', 9000));
    const older = event('user.updated', updatedPayload('user_w', 'older@example.com', 8000));
    await post(newer, signWebhook(newer, { id: 'msg_n' }));
    const res = await post(older, signWebhook(older, { id: 'msg_o' }));
    assert.equal(res.body.data.outcome, 'skipped_stale_or_unknown');
    assert.equal(fake.store.get('user_w').email, 'newer@example.com');
  });

  it('acknowledges events for users that never onboarded without creating records', async () => {
    const body = event('user.updated', updatedPayload('user_unknown', 'u@example.com', 5000));
    const res = await post(body, signWebhook(body));
    assert.equal(res.status, 200);
    assert.equal(fake.store.has('user_unknown'), false);
  });

  it('soft-deactivates on user.deleted, once', async () => {
    const body = event('user.deleted', { id: 'user_w', deleted: true });
    const first = await post(body, signWebhook(body, { id: 'msg_d1' }));
    const second = await post(body, signWebhook(body, { id: 'msg_d2' }));
    assert.equal(first.body.data.outcome, 'deactivated');
    assert.equal(second.body.data.outcome, 'skipped_already_deleted_or_unknown');
    const doc = fake.store.get('user_w');
    assert.equal(doc.accountStatus, 'DEACTIVATED');
    assert.equal(doc.role, 'DOCTOR'); // business record preserved
    assert.ok(doc.deletedAt);
  });

  it('acknowledges unsupported events without side effects', async () => {
    const body = event('user.created', { id: 'user_new' });
    const res = await post(body, signWebhook(body));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.outcome, 'ignored');
    assert.equal(fake.store.has('user_new'), false);
  });
});
