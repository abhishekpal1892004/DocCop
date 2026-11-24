import { signSessionToken } from './setup.js';
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createFakeUserRepository } from './helpers/fakeUserRepository.js';
import { createFakePatientRepository } from './helpers/fakePatientRepository.js';

const { default: app } = await import('../src/app.js');
const { userRepository } = await import('../src/modules/users/user.repository.js');
const { patientRepository } = await import('../src/modules/patients/patient.repository.js');
const { clerkGateway } = await import('../src/integrations/clerk/clerk.gateway.js');

const bearer = (id) => ({ Authorization: `Bearer ${signSessionToken(id)}` });

let fakeUsers;
let fakePatients;
let origUserRepo;
let origPatientRepo;

const validProfile = {
  dateOfBirth: '1995-05-15',
  gender: 'FEMALE',
  phoneNumber: '+919876543210',
  address: { street: '12 MG Road', city: 'Pune', state: 'Maharashtra', country: 'India', pincode: '411001' },
  emergencyContact: { name: 'Ravi Rao', relationship: 'Brother', phoneNumber: '+919876543211' },
};

beforeEach(async () => {
  fakeUsers = createFakeUserRepository();
  fakePatients = createFakePatientRepository();
  origUserRepo = { ...userRepository };
  origPatientRepo = { ...patientRepository };
  Object.assign(userRepository, fakeUsers.repo);
  Object.assign(patientRepository, fakePatients.repo);

  mock.method(clerkGateway, 'getUser', async (id) => ({
    id,
    firstName: 'Asha',
    lastName: 'Rao',
    primaryEmailAddressId: 'e1',
    emailAddresses: [{ id: 'e1', emailAddress: `${id}@example.com`, verification: { status: 'verified' } }],
    phoneNumbers: [],
    updatedAt: 1000,
  }));

  await request(app).post('/api/v1/users/onboard').set(bearer('pat_1')).send({ accountType: 'PATIENT' });
  await request(app).post('/api/v1/users/onboard').set(bearer('doc_1')).send({ accountType: 'DOCTOR' });
});

afterEach(() => {
  Object.assign(userRepository, origUserRepo);
  Object.assign(patientRepository, origPatientRepo);
  mock.restoreAll();
});

describe('Patient Management APIs', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/v1/patients/me');
    assert.equal(res.status, 401);
  });

  it('rejects DOCTOR access to patient-only APIs with 403', async () => {
    const res = await request(app).post('/api/v1/patients/profile').set(bearer('doc_1')).send(validProfile);
    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'INSUFFICIENT_ROLE');
  });

  it('creates a patient profile and marks User onboardingStatus as COMPLETED', async () => {
    const res = await request(app).post('/api/v1/patients/profile').set(bearer('pat_1')).send(validProfile);
    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.profile.profileCompleted, true);
    assert.equal(res.body.data.profile.address.city, 'Pune');
    assert.equal(fakeUsers.store.get('pat_1').onboardingStatus, 'COMPLETED');
  });

  it('prevents duplicate patient profile creation with 409', async () => {
    await request(app).post('/api/v1/patients/profile').set(bearer('pat_1')).send(validProfile);
    const dup = await request(app).post('/api/v1/patients/profile').set(bearer('pat_1')).send(validProfile);
    assert.equal(dup.status, 409);
    assert.equal(dup.body.code, 'PROFILE_ALREADY_EXISTS');
  });

  it('retrieves own profile and updates permitted fields without clobbering siblings', async () => {
    await request(app).post('/api/v1/patients/profile').set(bearer('pat_1')).send(validProfile);

    const getRes = await request(app).get('/api/v1/patients/me').set(bearer('pat_1'));
    assert.equal(getRes.status, 200);
    assert.equal(getRes.body.data.profile.gender, 'FEMALE');

    const patchRes = await request(app)
      .patch('/api/v1/patients/me')
      .set(bearer('pat_1'))
      .send({ address: { city: 'Mumbai' } });
    assert.equal(patchRes.status, 200);
    assert.equal(patchRes.body.data.profile.address.city, 'Mumbai');
    assert.equal(patchRes.body.data.profile.address.pincode, '411001');
  });

  it('rejects role or ownership injection in patient profile body', async () => {
    const res = await request(app)
      .post('/api/v1/patients/profile')
      .set(bearer('pat_1'))
      .send({ ...validProfile, role: 'ADMIN', userId: 'someone-else' });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'VALIDATION_ERROR');
  });
});
