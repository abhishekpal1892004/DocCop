import { signSessionToken } from './setup.js';
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createFakeUserRepository } from './helpers/fakeUserRepository.js';
import { createFakeSupportRepository } from './helpers/fakePhase10Repositories.js';
import { createFakeAbdmRepository } from './helpers/fakePhase11Repositories.js';

const { default: app } = await import('../src/app.js');
const { userRepository } = await import('../src/modules/users/user.repository.js');
const { supportRepository } = await import('../src/modules/support/support.repository.js');
const { abdmRepository } = await import('../src/modules/abdm/abdm.repository.js');
const { clerkGateway } = await import('../src/integrations/clerk/clerk.gateway.js');

const bearer = (id) => ({ Authorization: `Bearer ${signSessionToken(id)}` });

let fakeUsers;
let fakeSupport;
let fakeAbdm;
let origRepos;

beforeEach(() => {
  fakeUsers = createFakeUserRepository();
  fakeSupport = createFakeSupportRepository();
  fakeAbdm = createFakeAbdmRepository();
  origRepos = {
    user: { ...userRepository },
    support: { ...supportRepository },
    abdm: { ...abdmRepository },
  };
  Object.assign(userRepository, fakeUsers.repo);
  Object.assign(supportRepository, fakeSupport.repo);
  Object.assign(abdmRepository, fakeAbdm.repo);
  mock.method(clerkGateway, 'getUser', async (id) => ({
    id,
    emailAddresses: [{ emailAddress: `${id}@test.local` }],
    firstName: 'QA',
    lastName: 'User',
  }));
});

afterEach(() => {
  Object.assign(userRepository, origRepos.user);
  Object.assign(supportRepository, origRepos.support);
  Object.assign(abdmRepository, origRepos.abdm);
  mock.restoreAll();
});

describe('Phase 13 QA - Security, IDOR, Role Isolation & Negative Input Checks', () => {
  it('blocks unauthenticated, expired, suspended, and role-escalating requests', async () => {
    const expiredToken = signSessionToken('clerk_qa_pat', { expiresInSec: -10 });
    const unauth = await request(app).get('/api/v1/users/me');
    assert.equal(unauth.status, 401);

    const expiredRes = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${expiredToken}`);
    assert.equal(expiredRes.status, 401);

    const suspended = await fakeUsers.repo.create({
      clerkUserId: 'clerk_qa_susp',
      email: 'susp@test.local',
      role: 'PATIENT',
      accountStatus: 'SUSPENDED',
      onboardingStatus: 'COMPLETED',
    });
    const suspSupport = await request(app)
      .post('/api/v1/support/tickets')
      .set(bearer(suspended.clerkUserId))
      .send({ category: 'OTHER', priority: 'LOW', subject: 'Test', description: 'Blocked' });
    assert.equal(suspSupport.status, 403);

    // Public onboarding rejects ADMIN, CLINIC_MANAGER, RECEPTIONIST
    for (const forbiddenRole of ['ADMIN', 'CLINIC_MANAGER', 'RECEPTIONIST']) {
      const escRes = await request(app)
        .post('/api/v1/users/onboard')
        .set(bearer('clerk_new_qa'))
        .send({ accountType: forbiddenRole });
      assert.equal(escRes.status, 400);
    }
  });

  it('blocks receptionist from medical records, prescriptions, and admin routes', async () => {
    const receptionist = await fakeUsers.repo.create({
      clerkUserId: 'clerk_qa_rec',
      email: 'rec@test.local',
      role: 'RECEPTIONIST',
      accountStatus: 'ACTIVE',
      onboardingStatus: 'COMPLETED',
    });

    const mrRes = await request(app).get('/api/v1/medical-records/my').set(bearer(receptionist.clerkUserId));
    assert.equal(mrRes.status, 403);

    const rxRes = await request(app).get('/api/v1/prescriptions/my').set(bearer(receptionist.clerkUserId));
    assert.equal(rxRes.status, 403);

    const adminRes = await request(app).get('/api/v1/admin/system-health').set(bearer(receptionist.clerkUserId));
    assert.equal(adminRes.status, 403);
  });

  it('prevents cross-patient IDOR on support tickets and ABDM consents, and rejects malformed JSON', async () => {
    const pat1 = await fakeUsers.repo.create({
      clerkUserId: 'clerk_qa_p1',
      email: 'qap1@test.local',
      role: 'PATIENT',
      accountStatus: 'ACTIVE',
      onboardingStatus: 'COMPLETED',
    });
    const pat2 = await fakeUsers.repo.create({
      clerkUserId: 'clerk_qa_p2',
      email: 'qap2@test.local',
      role: 'PATIENT',
      accountStatus: 'ACTIVE',
      onboardingStatus: 'COMPLETED',
    });

    const ticket = await fakeSupport.repo.createTicket({
      ticketNumber: 'MB-SUP-99999',
      userId: pat1._id,
      userRole: 'PATIENT',
      category: 'OTHER',
      priority: 'LOW',
      subject: 'Private issue',
      description: 'Details',
      status: 'OPEN',
    });
    const idorTicket = await request(app)
      .get(`/api/v1/support/tickets/${ticket._id}`)
      .set(bearer(pat2.clerkUserId));
    assert.equal(idorTicket.status, 403);

    const consent = await fakeAbdm.repo.createConsent({
      patientId: pat1._id,
      consentRequestId: 'cr-idor-1',
      purpose: 'Care',
      requesterId: String(pat1._id),
      recordTypes: ['Prescription'],
      dateRange: { from: new Date('2026-01-01'), to: new Date('2026-11-01') },
      status: 'GRANTED',
      expiresAt: new Date('2027-01-01'),
    });
    const idorConsent = await request(app)
      .get(`/api/v1/abdm/hiu/consent/${consent._id}`)
      .set(bearer(pat2.clerkUserId));
    assert.equal(idorConsent.status, 403);

    // Malformed JSON
    const badJson = await request(app)
      .post('/api/v1/support/tickets')
      .set(bearer(pat1.clerkUserId))
      .set('Content-Type', 'application/json')
      .send('{"broken":');
    assert.equal(badJson.status, 400);
    assert.equal(badJson.body.code, 'MALFORMED_JSON');
  });
});
