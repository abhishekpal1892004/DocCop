import { signSessionToken } from './setup.js';
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createFakeUserRepository } from './helpers/fakeUserRepository.js';
import { createFakeSupportRepository } from './helpers/fakePhase10Repositories.js';

const { default: app } = await import('../src/app.js');
const { userRepository } = await import('../src/modules/users/user.repository.js');
const { auditLogRepository } = await import('../src/modules/auditLogs/auditLog.repository.js');
const { supportRepository } = await import('../src/modules/support/support.repository.js');
const { clerkGateway } = await import('../src/integrations/clerk/clerk.gateway.js');

const bearer = (id) => ({ Authorization: `Bearer ${signSessionToken(id)}` });

let fakeUsers;
let auditLogs;
let fakeSupport;
let origRepos;

beforeEach(async () => {
  fakeUsers = createFakeUserRepository();
  auditLogs = [];
  fakeSupport = createFakeSupportRepository();

  origRepos = {
    user: { ...userRepository },
    support: { ...supportRepository },
  };

  Object.assign(userRepository, fakeUsers.repo);
  Object.assign(supportRepository, fakeSupport.repo);
  mock.method(auditLogRepository, 'create', async (doc) => {
    const saved = { _id: `audit-${auditLogs.length + 1}`, ...doc, createdAt: new Date() };
    auditLogs.push(saved);
    return saved;
  });

  mock.method(clerkGateway, 'getUser', async (clerkUserId) => ({
    id: clerkUserId,
    emailAddresses: [{ emailAddress: `${clerkUserId}@test.local` }],
    firstName: 'Test',
    lastName: 'User',
  }));
});

afterEach(() => {
  Object.assign(userRepository, origRepos.user);
  Object.assign(supportRepository, origRepos.support);
  mock.restoreAll();
});

describe('Stage 10E - Patient Support & Complaint Management', () => {
  it('supports ticket creation, patient isolation, internal-note privacy, replies, and admin resolution', async () => {
    const pat1 = await fakeUsers.repo.create({
      clerkUserId: 'clerk_sup_pat1',
      email: 'suppat1@test.local',
      firstName: 'Pat',
      lastName: 'One',
      role: 'PATIENT',
      accountStatus: 'ACTIVE',
      onboardingStatus: 'COMPLETED',
    });
    const pat2 = await fakeUsers.repo.create({
      clerkUserId: 'clerk_sup_pat2',
      email: 'suppat2@test.local',
      firstName: 'Pat',
      lastName: 'Two',
      role: 'PATIENT',
      accountStatus: 'ACTIVE',
      onboardingStatus: 'COMPLETED',
    });
    const admin = await fakeUsers.repo.create({
      clerkUserId: 'clerk_sup_admin',
      email: 'supadmin@test.local',
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      accountStatus: 'ACTIVE',
      onboardingStatus: 'COMPLETED',
    });

    // Patient 1 creates ticket
    const createRes = await request(app)
      .post('/api/v1/support/tickets')
      .set(bearer(pat1.clerkUserId))
      .send({
        category: 'PAYMENT',
        priority: 'HIGH',
        subject: 'Double charge on consultation',
        description: 'I was charged twice for booking #123.',
      });
    assert.equal(createRes.status, 201);
    const ticketId = createRes.body.data.ticket.id;
    assert.ok(createRes.body.data.ticket.ticketNumber.startsWith('MB-SUP-'));
    assert.equal(createRes.body.data.ticket.status, 'OPEN');

    // Patient 2 cannot read Patient 1's ticket
    const isoRes = await request(app)
      .get(`/api/v1/support/tickets/${ticketId}`)
      .set(bearer(pat2.clerkUserId));
    assert.equal(isoRes.status, 403);

    // Patient 1 cannot post an internal note
    const patInternalRes = await request(app)
      .post(`/api/v1/support/tickets/${ticketId}/reply`)
      .set(bearer(pat1.clerkUserId))
      .send({ message: 'Trying internal', isInternalNote: true });
    assert.equal(patInternalRes.status, 403);

    // Admin lists all tickets
    const adminListRes = await request(app)
      .get('/api/v1/admin/support/tickets')
      .set(bearer(admin.clerkUserId));
    assert.equal(adminListRes.status, 200);
    assert.equal(adminListRes.body.data.tickets.length, 1);

    // Admin adds internal note + public reply
    const internalNoteRes = await request(app)
      .post(`/api/v1/support/tickets/${ticketId}/reply`)
      .set(bearer(admin.clerkUserId))
      .send({ message: 'Checked Razorpay dashboard, refund initiated.', isInternalNote: true });
    assert.equal(internalNoteRes.status, 201);

    const publicReplyRes = await request(app)
      .post(`/api/v1/support/tickets/${ticketId}/reply`)
      .set(bearer(admin.clerkUserId))
      .send({ message: 'We have initiated your refund.', isInternalNote: false });
    assert.equal(publicReplyRes.status, 201);
    assert.equal(publicReplyRes.body.data.ticket.status, 'IN_PROGRESS');

    // Patient 1 sees public reply, NOT internal note
    const patDetailsRes = await request(app)
      .get(`/api/v1/support/tickets/${ticketId}`)
      .set(bearer(pat1.clerkUserId));
    assert.equal(patDetailsRes.status, 200);
    assert.equal(patDetailsRes.body.data.messages.length, 2);
    assert.ok(patDetailsRes.body.data.messages.every((m) => !m.isInternalNote));

    // Admin resolves ticket and audit log is recorded
    const resolveRes = await request(app)
      .patch(`/api/v1/admin/support/tickets/${ticketId}`)
      .set(bearer(admin.clerkUserId))
      .send({
        status: 'RESOLVED',
        assignedAdminId: String(admin._id),
        resolutionNotes: 'Refund processed via Razorpay.',
      });
    assert.equal(resolveRes.status, 200);
    assert.equal(resolveRes.body.data.ticket.status, 'RESOLVED');
    assert.ok(resolveRes.body.data.ticket.resolvedAt);
    assert.equal(auditLogs.length, 1);
    assert.equal(auditLogs[0].action, 'SUPPORT_TICKET_UPDATED');
  });
});
