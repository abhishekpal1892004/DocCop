import { signSessionToken } from './setup.js';
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createFakeUserRepository } from './helpers/fakeUserRepository.js';
import { createFakeClinicRepository } from './helpers/fakePhase4Repositories.js';
import { createFakeOrganizationRepository, createFakeStaffRepository } from './helpers/fakePhase10Repositories.js';

const { default: app } = await import('../src/app.js');
const { userRepository } = await import('../src/modules/users/user.repository.js');
const { clinicRepository } = await import('../src/modules/clinics/clinic.repository.js');
const { organizationRepository } = await import('../src/modules/organizations/organization.repository.js');
const { staffRepository } = await import('../src/modules/staffManagement/staff.repository.js');
const { clerkGateway } = await import('../src/integrations/clerk/clerk.gateway.js');

const bearer = (id) => ({ Authorization: `Bearer ${signSessionToken(id)}` });

let fakeUsers;
let fakeClinics;
let fakeOrgs;
let fakeStaff;
let origRepos;

beforeEach(async () => {
  fakeUsers = createFakeUserRepository();
  fakeClinics = createFakeClinicRepository();
  fakeOrgs = createFakeOrganizationRepository();
  fakeStaff = createFakeStaffRepository();

  origRepos = {
    user: { ...userRepository },
    clinic: { ...clinicRepository },
    org: { ...organizationRepository },
    staff: { ...staffRepository },
  };

  Object.assign(userRepository, fakeUsers.repo);
  Object.assign(clinicRepository, fakeClinics.repo);
  Object.assign(organizationRepository, fakeOrgs.repo);
  Object.assign(staffRepository, fakeStaff.repo);

  mock.method(clerkGateway, 'getUser', async (id) => ({
    id,
    firstName: 'Staff',
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
  Object.assign(staffRepository, origRepos.staff);
  mock.restoreAll();
});

describe('Stage 10B: Receptionist & Clinic Staff Portal', () => {
  it('supports staff invitation, single-use acceptance, permission updates, removal, and blocks medical record access', async () => {
    await request(app).post('/api/v1/users/onboard').set(bearer('doc_1')).send({ accountType: 'DOCTOR' });

    // Public signup as RECEPTIONIST is blocked
    const pubStaff = await request(app)
      .post('/api/v1/users/onboard')
      .set(bearer('rec_1'))
      .send({ accountType: 'RECEPTIONIST' });
    assert.equal(pubStaff.status, 400);

    const orgRes = await request(app).post('/api/v1/organizations').set(bearer('doc_1')).send({ name: 'Care Group' });
    const orgId = orgRes.body.data.organization.id;

    const cRes = await request(app)
      .post(`/api/v1/organizations/${orgId}/clinics`)
      .set(bearer('doc_1'))
      .send({
        clinicName: 'Care Clinic A',
        clinicType: 'CLINIC',
        address: { street: '1 Main Rd', city: 'Delhi', state: 'Delhi', pincode: '110001' },
      });
    const clinicId = cRes.body.data.clinic.id;

    // Invite receptionist
    const invRes = await request(app)
      .post(`/api/v1/clinics/${clinicId}/staff/invite`)
      .set(bearer('doc_1'))
      .send({ email: 'rec_1@example.com', role: 'RECEPTIONIST' });
    assert.equal(invRes.status, 201);
    const token = invRes.body.data.invitationToken;

    // Duplicate pending invitation rejected
    const dupInv = await request(app)
      .post(`/api/v1/clinics/${clinicId}/staff/invite`)
      .set(bearer('doc_1'))
      .send({ email: 'rec_1@example.com', role: 'RECEPTIONIST' });
    assert.equal(dupInv.status, 409);

    // Accept invitation
    const accRes = await request(app)
      .post('/api/v1/staff/invitations/accept')
      .set(bearer('rec_1'))
      .send({ token });
    assert.equal(accRes.status, 200);
    assert.equal(accRes.body.data.membership.role, 'RECEPTIONIST');
    const membershipId = accRes.body.data.membership.id;

    // Single-use: reusing token fails
    const reuseRes = await request(app)
      .post('/api/v1/staff/invitations/accept')
      .set(bearer('rec_1'))
      .send({ token });
    assert.equal(reuseRes.status, 409);

    // Receptionist cannot access medical records or prescriptions
    const recMed = await request(app).get('/api/v1/medical-records/my').set(bearer('rec_1'));
    assert.equal(recMed.status, 403);
    const recRx = await request(app).get('/api/v1/prescriptions/my').set(bearer('rec_1'));
    assert.equal(recRx.status, 403);

    // Update permissions & remove membership
    const permRes = await request(app)
      .patch(`/api/v1/staff/${membershipId}/permissions`)
      .set(bearer('doc_1'))
      .send({ permissions: ['CLINIC_VIEW', 'PATIENT_CHECK_IN'] });
    assert.equal(permRes.status, 200);

    const recUser = fakeUsers.store.get('rec_1');
    const delRes = await request(app)
      .delete(`/api/v1/clinics/${clinicId}/staff/${recUser._id}`)
      .set(bearer('doc_1'));
    assert.equal(delRes.status, 200);
  });
});
