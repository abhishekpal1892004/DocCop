import { signSessionToken } from './setup.js';
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createFakeUserRepository } from './helpers/fakeUserRepository.js';
import { createFakeDoctorApplicationRepository, createFakeNmcLookupRepository } from './helpers/fakeDoctorRepositories.js';
import { createFakeClinicRepository, createFakeDoctorVerificationRepository } from './helpers/fakePhase4Repositories.js';

const { default: app } = await import('../src/app.js');
const { userRepository } = await import('../src/modules/users/user.repository.js');
const { doctorApplicationRepository } = await import('../src/modules/doctorApplications/doctorApplication.repository.js');
const { nmcLookupRepository } = await import('../src/modules/doctorVerification/nmcLookup.repository.js');
const { doctorVerificationRepository } = await import('../src/modules/doctorVerification/verification.repository.js');
const { clinicRepository } = await import('../src/modules/clinics/clinic.repository.js');
const { clerkGateway } = await import('../src/integrations/clerk/clerk.gateway.js');
const { nmcClient } = await import('../src/integrations/nmc/nmc.client.js');

const bearer = (id) => ({ Authorization: `Bearer ${signSessionToken(id)}` });

let fakeUsers;
let fakeApps;
let fakeLookups;
let fakeVerifications;
let fakeClinics;
let origUserRepo;
let origAppRepo;
let origLookupRepo;
let origVerificationRepo;
let origClinicRepo;

const fullApplication = {
  personalDetails: { fullName: 'Dr. Asha Rao', phoneNumber: '+919876543210' },
  professionalDetails: {
    qualification: 'MBBS, MD',
    specialization: 'Cardiology',
    experience: 8,
    medicalSystem: 'MODERN_MEDICINE',
    collegeName: 'KGMU Lucknow',
  },
  medicalRegistration: {
    councilName: 'Uttar Pradesh Medical Council',
    registrationNumber: 'UP-12345',
    registrationYear: 2018,
    stateCode: 'UP',
  },
  clinicDetails: {
    clinicName: 'Asha Heart Clinic',
    clinicType: 'CLINIC',
    relationship: 'OWNER',
    clinicRegistrationNumber: 'CLN-2020-99',
    registrationAuthority: 'CMO Lucknow',
    address: { street: '10 Hazratganj', city: 'Lucknow', state: 'Uttar Pradesh', country: 'India', pincode: '226001' },
  },
  gstDetails: {
    isGSTRegistered: true,
    gstin: '09AAACH7409R1ZZ',
    legalBusinessName: 'Asha Heart Clinic LLP',
  },
};

beforeEach(async () => {
  fakeUsers = createFakeUserRepository();
  fakeApps = createFakeDoctorApplicationRepository();
  fakeLookups = createFakeNmcLookupRepository();
  fakeVerifications = createFakeDoctorVerificationRepository();
  fakeClinics = createFakeClinicRepository();
  origUserRepo = { ...userRepository };
  origAppRepo = { ...doctorApplicationRepository };
  origLookupRepo = { ...nmcLookupRepository };
  origVerificationRepo = { ...doctorVerificationRepository };
  origClinicRepo = { ...clinicRepository };
  Object.assign(userRepository, fakeUsers.repo);
  Object.assign(doctorApplicationRepository, fakeApps.repo);
  Object.assign(nmcLookupRepository, fakeLookups.repo);
  Object.assign(doctorVerificationRepository, fakeVerifications.repo);
  Object.assign(clinicRepository, fakeClinics.repo);

  mock.method(clerkGateway, 'getUser', async (id) => ({
    id,
    firstName: 'Asha',
    lastName: 'Rao',
    imageUrl: 'https://img.example/doc.png',
    primaryEmailAddressId: 'e1',
    emailAddresses: [{ id: 'e1', emailAddress: `${id}@example.com`, verification: { status: 'verified' } }],
    phoneNumbers: [],
    updatedAt: 1000,
  }));

  await request(app).post('/api/v1/users/onboard').set(bearer('doc_1')).send({ accountType: 'DOCTOR' });
  await request(app).post('/api/v1/users/onboard').set(bearer('pat_1')).send({ accountType: 'PATIENT' });
});

afterEach(() => {
  Object.assign(userRepository, origUserRepo);
  Object.assign(doctorApplicationRepository, origAppRepo);
  Object.assign(nmcLookupRepository, origLookupRepo);
  Object.assign(doctorVerificationRepository, origVerificationRepo);
  Object.assign(clinicRepository, origClinicRepo);
  mock.restoreAll();
});

describe('Doctor Onboarding & Application APIs', () => {
  it('forbids PATIENT from accessing doctor application APIs', async () => {
    const res = await request(app).post('/api/v1/doctor-applications').set(bearer('pat_1')).send({});
    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'INSUFFICIENT_ROLE');
  });

  it('creates a draft application, prevents duplicates, and updates User onboardingStatus to IN_PROGRESS', async () => {
    const createRes = await request(app)
      .post('/api/v1/doctor-applications')
      .set(bearer('doc_1'))
      .send({ personalDetails: fullApplication.personalDetails });
    assert.equal(createRes.status, 201);
    assert.equal(createRes.body.data.application.applicationStatus, 'DRAFT');
    assert.equal(createRes.body.data.application.personalDetails.email, 'doc_1@example.com');
    assert.equal(fakeUsers.store.get('doc_1').onboardingStatus, 'IN_PROGRESS');

    const dup = await request(app).post('/api/v1/doctor-applications').set(bearer('doc_1')).send({});
    assert.equal(dup.status, 409);
    assert.equal(dup.body.code, 'APPLICATION_ALREADY_EXISTS');
  });

  it('rejects self-approval or ownership tampering on create and update', async () => {
    await request(app).post('/api/v1/doctor-applications').set(bearer('doc_1')).send({});
    for (const badBody of [
      { applicationStatus: 'APPROVED' },
      { nmcVerificationStatus: 'LOOKUP_COMPLETED' },
      { userId: 'another-user' },
      { personalDetails: { email: 'spoof@evil.com' } },
    ]) {
      const res = await request(app).patch('/api/v1/doctor-applications/me').set(bearer('doc_1')).send(badBody);
      assert.equal(res.status, 400, JSON.stringify(badBody));
      assert.equal(res.body.code, 'VALIDATION_ERROR');
    }
  });

  it('validates GSTIN checksum when provided and allows omitting GSTIN when not registered', async () => {
    await request(app).post('/api/v1/doctor-applications').set(bearer('doc_1')).send({});

    const badGst = await request(app)
      .patch('/api/v1/doctor-applications/me')
      .set(bearer('doc_1'))
      .send({ gstDetails: { isGSTRegistered: true, gstin: '09AAACH7409R1Z0', legalBusinessName: 'Bad' } });
    assert.equal(badGst.status, 400);

    const okGst = await request(app)
      .patch('/api/v1/doctor-applications/me')
      .set(bearer('doc_1'))
      .send({ gstDetails: { isGSTRegistered: true, gstin: '09aaach7409r1zz', legalBusinessName: 'Clinic LLP' } });
    assert.equal(okGst.status, 200);
    assert.equal(okGst.body.data.application.gstDetails.gstin, '09AAACH7409R1ZZ');
    assert.equal(okGst.body.data.application.gstDetails.verificationStatus, 'FORMAT_VALID_UNVERIFIED');
  });

  it('validates completeness and requires an NMC lookup attempt before submission', async () => {
    await request(app).post('/api/v1/doctor-applications').set(bearer('doc_1')).send({ personalDetails: fullApplication.personalDetails });
    const incomplete = await request(app).post('/api/v1/doctor-applications/submit').set(bearer('doc_1'));
    assert.equal(incomplete.status, 400);
    assert.equal(incomplete.body.code, 'VALIDATION_ERROR');

    await request(app).patch('/api/v1/doctor-applications/me').set(bearer('doc_1')).send(fullApplication);
    const noNmc = await request(app).post('/api/v1/doctor-applications/submit').set(bearer('doc_1'));
    assert.equal(noNmc.status, 400);
    assert.equal(noNmc.body.code, 'NMC_CHECK_REQUIRED');
  });

  it('invalidates prior NMC lookup when registration details change, and submits idempotently after lookup', async () => {
    await request(app).post('/api/v1/doctor-applications').set(bearer('doc_1')).send(fullApplication);

    mock.method(nmcClient, 'search', async () => ({
      total: 1,
      records: [
        {
          name: 'Asha Rao',
          registrationNumber: 'UP12345',
          registrationYear: 2018,
          stateCode: 'UP',
          councilName: 'Uttar Pradesh Medical Council',
          qualification: 'MBBS',
          qualificationYear: 2017,
          university: 'KGMU',
          additionalQualifications: [],
          removedStatus: '0',
        },
      ],
    }));

    const checkRes = await request(app).post('/api/v1/doctor-verification/nmc-check').set(bearer('doc_1')).send({
      name: 'Dr. Asha Rao',
      registrationNumber: 'UP-12345',
      registrationYear: 2018,
      state: 'UP',
    });
    assert.equal(checkRes.status, 200);
    assert.equal(checkRes.body.data.lookupStatus, 'MATCH_FOUND');
    assert.equal(checkRes.body.data.manualReviewRequired, true);

    // Changing registrationNumber invalidates the lookup.
    const editRes = await request(app)
      .patch('/api/v1/doctor-applications/me')
      .set(bearer('doc_1'))
      .send({ medicalRegistration: { registrationNumber: 'UP-99999' } });
    assert.equal(editRes.body.data.application.nmcVerificationStatus, 'NOT_CHECKED');
    assert.ok(fakeLookups.records[0].supersededAt);

    // Re-check with new number
    await request(app).post('/api/v1/doctor-verification/nmc-check').set(bearer('doc_1')).send({
      name: 'Dr. Asha Rao',
      registrationNumber: 'UP-99999',
      registrationYear: 2018,
      state: 'UP',
    });

    const submit1 = await request(app).post('/api/v1/doctor-applications/submit').set(bearer('doc_1'));
    assert.equal(submit1.status, 200);
    assert.equal(submit1.body.data.application.applicationStatus, 'SUBMITTED');
    assert.equal(fakeUsers.store.get('doc_1').onboardingStatus, 'PENDING_VERIFICATION');

    // Idempotent re-submit
    const submit2 = await request(app).post('/api/v1/doctor-applications/submit').set(bearer('doc_1'));
    assert.equal(submit2.status, 200);

    // Cannot freely edit after submission
    const lockedPatch = await request(app)
      .patch('/api/v1/doctor-applications/me')
      .set(bearer('doc_1'))
      .send({ professionalDetails: { experience: 10 } });
    assert.equal(lockedPatch.status, 409);
    assert.equal(lockedPatch.body.code, 'APPLICATION_LOCKED');

    // Status endpoint reflects real saved state
    const statusRes = await request(app).get('/api/v1/doctor-applications/status').set(bearer('doc_1'));
    assert.equal(statusRes.status, 200);
    assert.equal(statusRes.body.data.status.applicationStatus, 'SUBMITTED');
    assert.equal(statusRes.body.data.status.clinicRegistrationStatus, 'PENDING_VERIFICATION');
  });
});
