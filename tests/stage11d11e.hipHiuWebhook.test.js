import crypto from 'node:crypto';
import { signSessionToken } from './setup.js';
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createFakeUserRepository } from './helpers/fakeUserRepository.js';
import { createFakeDoctorRepository } from './helpers/fakeDoctorRepositories.js';
import { createFakeAppointmentRepository } from './helpers/fakePhase5Repositories.js';
import { createFakeAbdmRepository } from './helpers/fakePhase11Repositories.js';

const { default: app } = await import('../src/app.js');
const { userRepository } = await import('../src/modules/users/user.repository.js');
const { doctorRepository } = await import('../src/modules/doctors/doctor.repository.js');
const { appointmentRepository } = await import('../src/modules/appointments/appointment.repository.js');
const { patientRepository } = await import('../src/modules/patients/patient.repository.js');
const { prescriptionRepository } = await import('../src/modules/prescriptions/prescription.repository.js');
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
  return { raw, sig };
};

let fakeUsers;
let fakeDoctors;
let fakeAppointments;
let fakeAbdm;
let origRepos;

beforeEach(async () => {
  process.env.ABDM_WEBHOOK_SECRET = 'abdm-test-webhook-secret';
  fakeUsers = createFakeUserRepository();
  fakeDoctors = createFakeDoctorRepository();
  fakeAppointments = createFakeAppointmentRepository();
  fakeAbdm = createFakeAbdmRepository();

  origRepos = {
    user: { ...userRepository },
    doctor: { ...doctorRepository },
    appt: { ...appointmentRepository },
    abdm: { ...abdmRepository },
  };

  Object.assign(userRepository, fakeUsers.repo);
  Object.assign(doctorRepository, fakeDoctors.repo);
  Object.assign(appointmentRepository, fakeAppointments.repo);
  Object.assign(abdmRepository, fakeAbdm.repo);
  mock.method(auditLogRepository, 'create', async (doc) => ({ _id: 'audit-1', ...doc }));
  mock.method(patientRepository, 'findByUserId', async () => ({ gender: 'FEMALE' }));
  mock.method(clerkGateway, 'getUser', async (id) => ({
    id,
    emailAddresses: [{ emailAddress: `${id}@test.local` }],
    firstName: 'Test',
    lastName: 'User',
  }));
});

afterEach(() => {
  Object.assign(userRepository, origRepos.user);
  Object.assign(doctorRepository, origRepos.doctor);
  Object.assign(appointmentRepository, origRepos.appt);
  Object.assign(abdmRepository, origRepos.abdm);
  mock.restoreAll();
});

describe('Stages 11D & 11E - HIP, HIU, Consent, Webhooks & Admin Dashboard', () => {
  it('supports HIP linking, HIU consent lifecycle, revocation, webhook replay/HMAC security, and admin dashboard', async () => {
    const pat1 = await fakeUsers.repo.create({
      clerkUserId: 'clerk_ex_pat1',
      email: 'expat1@test.local',
      firstName: 'Neha',
      lastName: 'Kapoor',
      role: 'PATIENT',
      accountStatus: 'ACTIVE',
      onboardingStatus: 'COMPLETED',
    });
    const unrelatedDoc = await fakeUsers.repo.create({
      clerkUserId: 'clerk_ex_doc2',
      email: 'exdoc2@test.local',
      role: 'DOCTOR',
      accountStatus: 'ACTIVE',
      onboardingStatus: 'COMPLETED',
    });
    const admin = await fakeUsers.repo.create({
      clerkUserId: 'clerk_ex_admin',
      email: 'exadmin@test.local',
      role: 'ADMIN',
      accountStatus: 'ACTIVE',
      onboardingStatus: 'COMPLETED',
    });
    await fakeDoctors.repo.upsertFromApplication(
      {
        _id: 'app-ex-doc2',
        userId: unrelatedDoc._id,
        personalDetails: { fullName: 'Dr. Unrelated', email: unrelatedDoc.email },
        professionalDetails: { qualification: 'MBBS', specialization: 'General', experience: 4, medicalSystem: 'MODERN_MEDICINE' },
        medicalRegistration: { councilName: 'NMC', registrationNumber: 'NMC-EX-2', registrationYear: 2020, stateCode: 'MAH' },
        clinicDetails: { clinicName: 'Clinic 2', clinicType: 'CLINIC', address: { city: 'Mumbai' } },
      },
      unrelatedDoc._id,
      new Date(),
      {}
    );

    // Seed verified ABHA link for pat1
    await fakeAbdm.repo.upsertAbhaByPatientId(pat1._id, {
      abhaNumberEncrypted: abdmCrypto.encrypt('91-1111-2222-3333'),
      abhaNumberMasked: 'XX-XXXX-XXXX-3333',
      abhaAddressEncrypted: abdmCrypto.encrypt('neha.kapoor@sbx'),
      abhaAddressMasked: 'ne***@sbx',
      verificationStatus: 'VERIFIED',
    });

    mock.method(prescriptionRepository, 'findById', async (id) =>
      id === 'rx-hip-1'
        ? {
            _id: 'rx-hip-1',
            prescriptionNumber: 'MB-RX-99',
            patientId: pat1._id,
            status: 'ISSUED',
            issuedAt: new Date(),
            medicines: [{ medicineName: 'Vitamin D3', dose: '1 cap', frequency: 'OD', duration: '30 days' }],
          }
        : null
    );
    mock.method(abdmClient, 'hipLinkCareContext', async () => ({ status: 'ACKNOWLEDGED' }));
    mock.method(abdmClient, 'hiuInitConsentRequest', async () => ({ status: 'REQUESTED' }));
    mock.method(abdmClient, 'hiuRequestHealthInformation', async () => ({ status: 'REQUESTED' }));
    mock.method(abdmClient, 'hiuRevokeConsent', async () => ({ status: 'REVOKED' }));

    // 1. HIP link & duplicate prevention
    const hipRes = await request(app)
      .post('/api/v1/abdm/hip/records/link')
      .set(bearer(pat1.clerkUserId))
      .send({ recordSourceType: 'PRESCRIPTION', healthRecordId: 'rx-hip-1' });
    assert.equal(hipRes.status, 201);
    assert.equal(hipRes.body.data.exchange.role, 'HIP');
    assert.equal(hipRes.body.data.exchange.status, 'INITIATED');

    const hipDupRes = await request(app)
      .post('/api/v1/abdm/hip/records/link')
      .set(bearer(pat1.clerkUserId))
      .send({ recordSourceType: 'PRESCRIPTION', healthRecordId: 'rx-hip-1' });
    assert.equal(hipDupRes.status, 409);

    // 2. Unrelated doctor cannot request HIU consent for pat1
    const docConsentForbidden = await request(app)
      .post('/api/v1/abdm/hiu/consent-request')
      .set(bearer(unrelatedDoc.clerkUserId))
      .send({
        patientId: String(pat1._id),
        purpose: 'Care management',
        recordTypes: ['Prescription'],
        dateRange: { from: '2026-01-01T00:00:00Z', to: '2026-11-01T00:00:00Z' },
        expiresAt: '2027-01-01T00:00:00Z',
      });
    assert.equal(docConsentForbidden.status, 403);

    // 3. Patient initiates HIU consent request
    const consentRes = await request(app)
      .post('/api/v1/abdm/hiu/consent-request')
      .set(bearer(pat1.clerkUserId))
      .send({
        purpose: 'View external lab reports',
        recordTypes: ['DiagnosticReport'],
        dateRange: { from: '2026-01-01T00:00:00Z', to: '2026-11-01T00:00:00Z' },
        expiresAt: '2027-01-01T00:00:00Z',
      });
    assert.equal(consentRes.status, 201);
    const consent = consentRes.body.data.consent;

    // Cannot request data while consent is still REQUESTED (not GRANTED)
    const blockedDataRes = await request(app)
      .post('/api/v1/abdm/hiu/data-request')
      .set(bearer(pat1.clerkUserId))
      .send({ consentId: consent.id });
    assert.equal(blockedDataRes.status, 403);

    // 4. ABDM webhook rejects invalid signature & stale replay timestamp
    const nowTs = new Date().toISOString();
    const consentWebhook = {
      eventId: 'evt-consent-1',
      eventType: 'CONSENT_NOTIFICATION',
      timestamp: nowTs,
      consentRequestId: consent.consentRequestId,
      consentManagerReference: 'cm-art-1001',
      status: 'GRANTED',
    };
    const badSigRes = await request(app)
      .post('/api/v1/webhooks/abdm')
      .set('x-abdm-timestamp', nowTs)
      .set('x-abdm-signature', 'bad-signature')
      .send(consentWebhook);
    assert.equal(badSigRes.status, 401);

    const staleTs = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { sig: staleSig } = signWebhook(consentWebhook, staleTs);
    const replayRes = await request(app)
      .post('/api/v1/webhooks/abdm')
      .set('x-abdm-timestamp', staleTs)
      .set('x-abdm-signature', staleSig)
      .send(consentWebhook);
    assert.equal(replayRes.status, 401);

    // Valid webhook grants consent; duplicate eventId is deduplicated
    const { sig: validSig } = signWebhook(consentWebhook, nowTs);
    const okHookRes = await request(app)
      .post('/api/v1/webhooks/abdm')
      .set('x-abdm-timestamp', nowTs)
      .set('x-abdm-signature', validSig)
      .send(consentWebhook);
    assert.equal(okHookRes.status, 200);
    assert.equal(okHookRes.body.data.duplicate, false);

    const dupHookRes = await request(app)
      .post('/api/v1/webhooks/abdm')
      .set('x-abdm-timestamp', nowTs)
      .set('x-abdm-signature', validSig)
      .send(consentWebhook);
    assert.equal(dupHookRes.status, 200);
    assert.equal(dupHookRes.body.data.duplicate, true);

    // 5. Patient can now request external data with GRANTED consent
    const dataReqRes = await request(app)
      .post('/api/v1/abdm/hiu/data-request')
      .set(bearer(pat1.clerkUserId))
      .send({ consentId: consent.id });
    assert.equal(dataReqRes.status, 201);
    assert.equal(dataReqRes.body.data.exchange.role, 'HIU');

    // 6. Patient revokes consent -> future data request blocked
    const revokeRes = await request(app)
      .post(`/api/v1/abdm/hiu/consent/${consent.id}/revoke`)
      .set(bearer(pat1.clerkUserId));
    assert.equal(revokeRes.status, 200);
    assert.equal(revokeRes.body.data.consent.status, 'REVOKED');

    const postRevokeDataRes = await request(app)
      .post('/api/v1/abdm/hiu/data-request')
      .set(bearer(pat1.clerkUserId))
      .send({ consentId: consent.id });
    assert.equal(postRevokeDataRes.status, 403);

    // 7. Admin ABDM dashboard
    const dashRes = await request(app)
      .get('/api/v1/abdm/admin/dashboard')
      .set(bearer(admin.clerkUserId));
    assert.equal(dashRes.status, 200);
    assert.equal(dashRes.body.data.metrics.abhaLinkedPatients, 1);
    assert.equal(dashRes.body.data.metrics.hipTransactions, 1);
    assert.equal(dashRes.body.data.metrics.hiuTransactions, 1);
  });
});
