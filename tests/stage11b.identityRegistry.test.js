import { signSessionToken } from './setup.js';
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createFakeUserRepository } from './helpers/fakeUserRepository.js';
import { createFakeDoctorRepository } from './helpers/fakeDoctorRepositories.js';
import { createFakeClinicRepository } from './helpers/fakePhase4Repositories.js';
import { createFakeAbdmRepository } from './helpers/fakePhase11Repositories.js';

const { default: app } = await import('../src/app.js');
const { userRepository } = await import('../src/modules/users/user.repository.js');
const { doctorRepository } = await import('../src/modules/doctors/doctor.repository.js');
const { clinicRepository } = await import('../src/modules/clinics/clinic.repository.js');
const { auditLogRepository } = await import('../src/modules/auditLogs/auditLog.repository.js');
const { abdmRepository } = await import('../src/modules/abdm/abdm.repository.js');
const { abdmClient } = await import('../src/integrations/abdm/abdm.client.js');
const { clerkGateway } = await import('../src/integrations/clerk/clerk.gateway.js');

const bearer = (id) => ({ Authorization: `Bearer ${signSessionToken(id)}` });

let fakeUsers;
let fakeDoctors;
let fakeClinics;
let fakeAbdm;
let origRepos;

beforeEach(async () => {
  fakeUsers = createFakeUserRepository();
  fakeDoctors = createFakeDoctorRepository();
  fakeClinics = createFakeClinicRepository();
  fakeAbdm = createFakeAbdmRepository();

  origRepos = {
    user: { ...userRepository },
    doctor: { ...doctorRepository },
    clinic: { ...clinicRepository },
    abdm: { ...abdmRepository },
  };

  Object.assign(userRepository, fakeUsers.repo);
  Object.assign(doctorRepository, fakeDoctors.repo);
  Object.assign(clinicRepository, fakeClinics.repo);
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
  Object.assign(doctorRepository, origRepos.doctor);
  Object.assign(clinicRepository, origRepos.clinic);
  Object.assign(abdmRepository, origRepos.abdm);
  mock.restoreAll();
});

describe('Stage 11B - Optional ABHA, HPR & HFR Linking', () => {
  it('allows optional ABHA linking, masks identifiers, blocks duplicates, and supports unlinking', async () => {
    const pat1 = await fakeUsers.repo.create({
      clerkUserId: 'clerk_abha_1',
      email: 'pat1@test.local',
      role: 'PATIENT',
      accountStatus: 'ACTIVE',
      onboardingStatus: 'COMPLETED',
    });
    const pat2 = await fakeUsers.repo.create({
      clerkUserId: 'clerk_abha_2',
      email: 'pat2@test.local',
      role: 'PATIENT',
      accountStatus: 'ACTIVE',
      onboardingStatus: 'COMPLETED',
    });

    // Optional: NOT_LINKED by default
    const initialStatus = await request(app).get('/api/v1/abdm/abha/status').set(bearer(pat1.clerkUserId));
    assert.equal(initialStatus.status, 200);
    assert.equal(initialStatus.body.data.abha.linked, false);
    assert.equal(initialStatus.body.data.abha.verificationStatus, 'NOT_LINKED');

    mock.method(abdmClient, 'initiateAbhaVerification', async () => ({ txnId: 'txn-abha-100' }));
    mock.method(abdmClient, 'verifyAbhaOtp', async ({ otp }) =>
      otp === '123456'
        ? { verified: true, ABHANumber: '91-1234-5678-9012', abhaAddress: 'pat1.med@sbx' }
        : { verified: false }
    );

    const initRes = await request(app)
      .post('/api/v1/abdm/abha/initiate-link')
      .set(bearer(pat1.clerkUserId))
      .send({ abhaNumber: '91-1234-5678-9012', abhaAddress: 'pat1.med@sbx' });
    assert.equal(initRes.status, 200);
    assert.equal(initRes.body.data.txnId, 'txn-abha-100');

    const verifyRes = await request(app)
      .post('/api/v1/abdm/abha/verify')
      .set(bearer(pat1.clerkUserId))
      .send({ txnId: 'txn-abha-100', otp: '123456' });
    assert.equal(verifyRes.status, 200);
    assert.equal(verifyRes.body.data.abha.linked, true);
    assert.equal(verifyRes.body.data.abha.abhaNumberMasked, 'XX-XXXX-XXXX-9012');
    assert.equal(verifyRes.body.data.abha.abhaAddressMasked, 'pa***@sbx');
    assert.ok(!JSON.stringify(verifyRes.body).includes('91-1234-5678-9012'));

    // Duplicate linking by another patient is blocked
    const dupRes = await request(app)
      .post('/api/v1/abdm/abha/initiate-link')
      .set(bearer(pat2.clerkUserId))
      .send({ abhaNumber: '91-1234-5678-9012' });
    assert.equal(dupRes.status, 409);

    // Unlink
    const unlinkRes = await request(app).delete('/api/v1/abdm/abha/unlink').set(bearer(pat1.clerkUserId));
    assert.equal(unlinkRes.status, 200);
    assert.equal(unlinkRes.body.data.abha.verificationStatus, 'REVOKED');
  });

  it('links HPR for approved doctor and HFR for clinic without altering Phase 4 verification', async () => {
    const docUser = await fakeUsers.repo.create({
      clerkUserId: 'clerk_hpr_doc',
      email: 'hprdoc@test.local',
      role: 'DOCTOR',
      accountStatus: 'ACTIVE',
      onboardingStatus: 'COMPLETED',
    });
    await fakeDoctors.repo.upsertFromApplication(
      {
        _id: 'app-hpr-1',
        userId: docUser._id,
        personalDetails: { fullName: 'Dr. Ananya Rao', email: docUser.email },
        professionalDetails: { qualification: 'MBBS, MD', specialization: 'Medicine', experience: 8, medicalSystem: 'MODERN_MEDICINE' },
        medicalRegistration: { councilName: 'NMC', registrationNumber: 'NMC-HPR-1', registrationYear: 2018, stateCode: 'KAR' },
        clinicDetails: { clinicName: 'Rao Clinic', clinicType: 'CLINIC', address: { city: 'Bengaluru' } },
      },
      docUser._id,
      new Date(),
      {}
    );
    const clinic = await fakeClinics.repo.create({
      clinicName: 'Rao Care Clinic',
      clinicType: 'CLINIC',
      createdByUserId: docUser._id,
      verificationStatus: 'PENDING_VERIFICATION',
      address: { city: 'Bengaluru', state: 'Karnataka' },
    });

    mock.method(abdmClient, 'lookupHprProfile', async (hprId) => ({
      hprId,
      name: 'Dr. Ananya Rao',
      status: 'ACTIVE',
    }));
    mock.method(abdmClient, 'lookupHfrFacility', async (hfrId) => ({
      facilityId: hfrId,
      facilityName: 'Rao Care Clinic',
      address: 'Bengaluru, Karnataka',
      status: 'ACTIVE',
    }));

    const hprRes = await request(app)
      .post('/api/v1/abdm/hpr/link')
      .set(bearer(docUser.clerkUserId))
      .send({ hprId: 'HPR-998877' });
    assert.equal(hprRes.status, 200);
    assert.equal(hprRes.body.data.hprLink.verificationResult, 'MATCH_FOUND');
    assert.equal(hprRes.body.data.hprLink.adminReviewStatus, 'PENDING');

    const hfrRes = await request(app)
      .post('/api/v1/abdm/hfr/link')
      .set(bearer(docUser.clerkUserId))
      .send({ clinicId: String(clinic._id), hfrId: 'IN29100001' });
    assert.equal(hfrRes.status, 200);
    assert.equal(hfrRes.body.data.hfrLink.verificationResult, 'MATCH_FOUND');

    // Clinic statutory verification status from Phase 4 must remain unchanged
    const storedClinic = await fakeClinics.repo.findById(clinic._id);
    assert.equal(storedClinic.verificationStatus, 'PENDING_VERIFICATION');
  });
});
