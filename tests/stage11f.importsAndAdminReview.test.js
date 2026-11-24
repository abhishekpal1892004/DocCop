import crypto from 'node:crypto';
import { signSessionToken } from './setup.js';
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createFakeUserRepository } from './helpers/fakeUserRepository.js';
import { createFakeAbdmRepository } from './helpers/fakePhase11Repositories.js';

const { default: app } = await import('../src/app.js');
const { userRepository } = await import('../src/modules/users/user.repository.js');
const { auditLogRepository } = await import('../src/modules/auditLogs/auditLog.repository.js');
const { abdmRepository } = await import('../src/modules/abdm/abdm.repository.js');
const { abdmClient } = await import('../src/integrations/abdm/abdm.client.js');
const { abdmCrypto } = await import('../src/integrations/abdm/abdm.crypto.js');
const { clerkGateway } = await import('../src/integrations/clerk/clerk.gateway.js');

const bearer = (id) => ({ Authorization: `Bearer ${signSessionToken(id)}` });

const signWebhook = (bodyObj, ts) => {
  const raw = JSON.stringify(bodyObj);
  const sig = crypto
    .createHmac('sha256', process.env.ABDM_WEBHOOK_SECRET)
    .update(`${ts}.${raw}`)
    .digest('hex');
  return { sig };
};

let fakeUsers;
let fakeAbdm;
let origRepos;

beforeEach(() => {
  process.env.ABDM_WEBHOOK_SECRET = 'abdm-test-webhook-secret';
  fakeUsers = createFakeUserRepository();
  fakeAbdm = createFakeAbdmRepository();
  origRepos = { user: { ...userRepository }, abdm: { ...abdmRepository } };
  Object.assign(userRepository, fakeUsers.repo);
  Object.assign(abdmRepository, fakeAbdm.repo);
  mock.method(auditLogRepository, 'create', async (doc) => ({ _id: 'audit-1', ...doc }));
  mock.method(clerkGateway, 'getUser', async (id) => ({
    id,
    emailAddresses: [{ emailAddress: `${id}@test.local` }],
    firstName: 'Test',
    lastName: 'User',
  }));
});

afterEach(() => {
  Object.assign(userRepository, origRepos.user);
  Object.assign(abdmRepository, origRepos.abdm);
  mock.restoreAll();
});

describe('Stage 11 (Extended) - FhirImport Isolation, Consent Rejection Guard & Admin HPR Review', () => {
  it('stores external FhirImport without duplicates, blocks REJECTED->GRANTED flip, and supports admin registry review', async () => {
    const pat = await fakeUsers.repo.create({
      clerkUserId: 'clerk_imp_pat',
      email: 'imppat@test.local',
      role: 'PATIENT',
      accountStatus: 'ACTIVE',
      onboardingStatus: 'COMPLETED',
    });
    const admin = await fakeUsers.repo.create({
      clerkUserId: 'clerk_imp_admin',
      email: 'impadmin@test.local',
      role: 'ADMIN',
      accountStatus: 'ACTIVE',
      onboardingStatus: 'COMPLETED',
    });

    await fakeAbdm.repo.upsertAbhaByPatientId(pat._id, {
      abhaNumberEncrypted: abdmCrypto.encrypt('91-5555-6666-7777'),
      abhaNumberMasked: 'XX-XXXX-XXXX-7777',
      verificationStatus: 'VERIFIED',
    });

    // 1. REJECTED consent cannot be flipped to GRANTED via webhook
    const rejConsent = await fakeAbdm.repo.createConsent({
      patientId: pat._id,
      consentRequestId: 'cr-rej-1',
      purpose: 'Care',
      requesterId: String(pat._id),
      recordTypes: ['DiagnosticReport'],
      dateRange: { from: new Date('2026-01-01'), to: new Date('2026-11-01') },
      status: 'REJECTED',
      expiresAt: new Date('2027-01-01'),
    });

    const ts1 = new Date().toISOString();
    const flipPayload = {
      eventId: 'evt-flip-1',
      eventType: 'CONSENT_NOTIFICATION',
      timestamp: ts1,
      consentRequestId: rejConsent.consentRequestId,
      status: 'GRANTED',
    };
    await request(app)
      .post('/api/v1/webhooks/abdm')
      .set('x-abdm-timestamp', ts1)
      .set('x-abdm-signature', signWebhook(flipPayload, ts1).sig)
      .send(flipPayload);

    const afterFlip = await fakeAbdm.repo.findConsentById(rejConsent._id);
    assert.equal(afterFlip.status, 'REJECTED');

    // 2. Valid HIU_DATA_PUSH imports external FHIR bundle once and marks isExternal: true
    const grantedConsent = await fakeAbdm.repo.createConsent({
      patientId: pat._id,
      consentRequestId: 'cr-grant-1',
      consentManagerReference: 'cm-grant-1',
      purpose: 'Care',
      requesterId: String(pat._id),
      recordTypes: ['DiagnosticReport'],
      dateRange: { from: new Date('2026-01-01'), to: new Date('2026-11-01') },
      status: 'GRANTED',
      expiresAt: new Date('2027-01-01'),
    });
    mock.method(abdmClient, 'hiuRequestHealthInformation', async () => ({ status: 'REQUESTED' }));
    const reqRes = await request(app)
      .post('/api/v1/abdm/hiu/data-request')
      .set(bearer(pat.clerkUserId))
      .send({ consentId: String(grantedConsent._id) });
    assert.equal(reqRes.status, 201);
    const txId = reqRes.body.data.exchange.transactionId;

    const validBundle = {
      resourceType: 'Bundle',
      id: 'ext-bundle-99',
      type: 'document',
      timestamp: new Date().toISOString(),
      entry: [
        {
          fullUrl: 'urn:uuid:comp-ext-1',
          resource: {
            resourceType: 'Composition',
            meta: { profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/Composition'] },
            status: 'final',
            type: { text: 'Diagnostic Report' },
            subject: { reference: 'urn:uuid:pat-ext-1' },
            date: new Date().toISOString(),
            author: [{ reference: 'urn:uuid:pat-ext-1' }],
            title: 'External Lab Report',
          },
        },
        {
          fullUrl: 'urn:uuid:pat-ext-1',
          resource: {
            resourceType: 'Patient',
            meta: { profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/Patient'] },
            name: [{ text: 'External Patient' }],
          },
        },
      ],
    };

    const ts2 = new Date().toISOString();
    const pushPayload = {
      eventId: 'evt-push-1',
      eventType: 'HIU_DATA_PUSH',
      timestamp: ts2,
      transactionId: txId,
      hipId: 'HIP-EXT-01',
      bundle: validBundle,
    };
    const pushRes = await request(app)
      .post('/api/v1/webhooks/abdm')
      .set('x-abdm-timestamp', ts2)
      .set('x-abdm-signature', signWebhook(pushPayload, ts2).sig)
      .send(pushPayload);
    assert.equal(pushRes.status, 200);

    const importsRes = await request(app)
      .get('/api/v1/abdm/hiu/imports/my')
      .set(bearer(pat.clerkUserId));
    assert.equal(importsRes.status, 200);
    assert.equal(importsRes.body.data.imports.length, 1);
    assert.equal(importsRes.body.data.imports[0].isExternal, true);
    assert.equal(importsRes.body.data.imports[0].externalBundleId, 'ext-bundle-99');

    // 3. Admin HPR/HFR registry review
    const regLink = await fakeAbdm.repo.upsertRegistryLink('HPR', 'doc-123', {
      registryType: 'HPR',
      targetId: 'doc-123',
      registryId: 'HPR-123',
      adminReviewStatus: 'PENDING',
    });

    const patReviewForbidden = await request(app)
      .patch(`/api/v1/abdm/admin/registry/${regLink._id}/review`)
      .set(bearer(pat.clerkUserId))
      .send({ adminReviewStatus: 'APPROVED' });
    assert.equal(patReviewForbidden.status, 403);

    const adminReviewRes = await request(app)
      .patch(`/api/v1/abdm/admin/registry/${regLink._id}/review`)
      .set(bearer(admin.clerkUserId))
      .send({ adminReviewStatus: 'APPROVED' });
    assert.equal(adminReviewRes.status, 200);
    assert.equal(adminReviewRes.body.data.registryLink.adminReviewStatus, 'APPROVED');
  });
});
