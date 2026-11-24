import { signSessionToken } from './setup.js';
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createFakeUserRepository } from './helpers/fakeUserRepository.js';
import { createFakeClinicRepository } from './helpers/fakePhase4Repositories.js';
import { createFakeOrganizationRepository } from './helpers/fakePhase10Repositories.js';

const { default: app } = await import('../src/app.js');
const { userRepository } = await import('../src/modules/users/user.repository.js');
const { clinicRepository } = await import('../src/modules/clinics/clinic.repository.js');
const { organizationRepository } = await import('../src/modules/organizations/organization.repository.js');
const { clerkGateway } = await import('../src/integrations/clerk/clerk.gateway.js');

const bearer = (id) => ({ Authorization: `Bearer ${signSessionToken(id)}` });

let fakeUsers;
let fakeClinics;
let fakeOrgs;
let origRepos;

beforeEach(async () => {
  fakeUsers = createFakeUserRepository();
  fakeClinics = createFakeClinicRepository();
  fakeOrgs = createFakeOrganizationRepository();

  origRepos = {
    user: { ...userRepository },
    clinic: { ...clinicRepository },
    org: { ...organizationRepository },
  };

  Object.assign(userRepository, fakeUsers.repo);
  Object.assign(clinicRepository, fakeClinics.repo);
  Object.assign(organizationRepository, fakeOrgs.repo);

  // Add findByOrganizationId to fakeClinics.repo
  clinicRepository.findByOrganizationId = async (orgId) =>
    [...fakeClinics.clinics.values()]
      .filter((c) => String(c.organizationId) === String(orgId))
      .map((c) => structuredClone(c));

  mock.method(clerkGateway, 'getUser', async (id) => ({
    id,
    firstName: 'Test',
    lastName: id,
    imageUrl: 'https://img.example/u.png',
    primaryEmailAddressId: 'e1',
    emailAddresses: [{ id: 'e1', emailAddress: `${id}@example.com`, verification: { status: 'verified' } }],
    phoneNumbers: [],
    updatedAt: 1000,
  }));
});

afterEach(() => {
  Object.assign(userRepository, origRepos.user);
  Object.assign(clinicRepository, origRepos.clinic);
  Object.assign(organizationRepository, origRepos.org);
  mock.restoreAll();
});

describe('Stage 10A: Multi-Clinic & Organization Management', () => {
  it('creates organization, adds multiple clinics, and blocks cross-organization access', async () => {
    await request(app).post('/api/v1/users/onboard').set(bearer('doc_1')).send({ accountType: 'DOCTOR' });
    await request(app).post('/api/v1/users/onboard').set(bearer('doc_other')).send({ accountType: 'DOCTOR' });

    const orgRes = await request(app)
      .post('/api/v1/organizations')
      .set(bearer('doc_1'))
      .send({ name: 'City Care Healthcare', legalName: 'City Care Pvt Ltd' });
    assert.equal(orgRes.status, 201);
    const orgId = orgRes.body.data.organization.id;

    // Add 2 clinics under organization
    const c1 = await request(app)
      .post(`/api/v1/organizations/${orgId}/clinics`)
      .set(bearer('doc_1'))
      .send({
        clinicName: 'City Care – Ghaziabad',
        clinicType: 'HOSPITAL',
        address: { street: '12 Raj Nagar', city: 'Ghaziabad', state: 'Uttar Pradesh', pincode: '201001' },
      });
    assert.equal(c1.status, 201);
    assert.equal(c1.body.data.clinic.organizationId, orgId);

    const c2 = await request(app)
      .post(`/api/v1/organizations/${orgId}/clinics`)
      .set(bearer('doc_1'))
      .send({
        clinicName: 'City Care – Noida',
        clinicType: 'CLINIC',
        address: { street: 'Sector 18', city: 'Noida', state: 'Uttar Pradesh', pincode: '201301' },
      });
    assert.equal(c2.status, 201);

    const listOwn = await request(app).get(`/api/v1/organizations/${orgId}/clinics`).set(bearer('doc_1'));
    assert.equal(listOwn.status, 200);
    assert.equal(listOwn.body.data.clinics.length, 2);

    // Unrelated user cannot view or add clinics to doc_1's organization
    const crossList = await request(app).get(`/api/v1/organizations/${orgId}/clinics`).set(bearer('doc_other'));
    assert.equal(crossList.status, 403);

    const viewUnverifiedClinic = await request(app)
      .get(`/api/v1/clinics/${c1.body.data.clinic.id}`)
      .set(bearer('doc_other'));
    assert.equal(viewUnverifiedClinic.status, 403);

    const viewOwnClinic = await request(app)
      .get(`/api/v1/clinics/${c1.body.data.clinic.id}`)
      .set(bearer('doc_1'));
    assert.equal(viewOwnClinic.status, 200);
  });
});
