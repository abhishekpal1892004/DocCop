import { signSessionToken } from './setup.js';
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createFakeUserRepository } from './helpers/fakeUserRepository.js';
import {
  createFakeDoctorApplicationRepository,
  createFakeDoctorRepository,
  createFakeNmcLookupRepository,
} from './helpers/fakeDoctorRepositories.js';
import {
  createFakeAuditLogRepository,
  createFakeClinicRepository,
  createFakeDoctorVerificationRepository,
} from './helpers/fakePhase4Repositories.js';
import { createFakeCalendlyRepository } from './helpers/fakePhase5Repositories.js';

const { default: app } = await import('../src/app.js');
const { userRepository } = await import('../src/modules/users/user.repository.js');
const { doctorApplicationRepository } = await import('../src/modules/doctorApplications/doctorApplication.repository.js');
const { nmcLookupRepository } = await import('../src/modules/doctorVerification/nmcLookup.repository.js');
const { doctorVerificationRepository } = await import('../src/modules/doctorVerification/verification.repository.js');
const { doctorRepository } = await import('../src/modules/doctors/doctor.repository.js');
const { clinicRepository } = await import('../src/modules/clinics/clinic.repository.js');
const { auditLogRepository } = await import('../src/modules/auditLogs/auditLog.repository.js');
const { calendlyRepository } = await import('../src/modules/calendly/calendly.repository.js');
const { clerkGateway } = await import('../src/integrations/clerk/clerk.gateway.js');
const { nmcClient } = await import('../src/integrations/nmc/nmc.client.js');

const bearer = (id) => ({ Authorization: `Bearer ${signSessionToken(id)}` });

let fakeUsers;
let fakeApps;
let fakeLookups;
let fakeVerifications;
let fakeDoctors;
let fakeClinics;
let fakeAudits;
let fakeCalendly;

let origUserRepo;
let origAppRepo;
let origLookupRepo;
let origVerificationRepo;
let origDoctorRepo;
let origClinicRepo;
let origAuditRepo;
let origCalendlyRepo;

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
    clinicRegistrationNumber: 'CLN-UP-101',
    registrationAuthority: 'CMO Lucknow',
    address: { street: '10 Hazratganj', city: 'Lucknow', state: 'Uttar Pradesh', country: 'India', pincode: '226001' },
  },
  gstDetails: { isGSTRegistered: false },
};

beforeEach(async () => {
  fakeUsers = createFakeUserRepository();
  fakeApps = createFakeDoctorApplicationRepository();
  fakeLookups = createFakeNmcLookupRepository();
  fakeVerifications = createFakeDoctorVerificationRepository();
  fakeDoctors = createFakeDoctorRepository();
  fakeClinics = createFakeClinicRepository();
  fakeAudits = createFakeAuditLogRepository();
  fakeCalendly = createFakeCalendlyRepository();

  origUserRepo = { ...userRepository };
  origAppRepo = { ...doctorApplicationRepository };
  origLookupRepo = { ...nmcLookupRepository };
  origVerificationRepo = { ...doctorVerificationRepository };
  origDoctorRepo = { ...doctorRepository };
  origClinicRepo = { ...clinicRepository };
  origAuditRepo = { ...auditLogRepository };
  origCalendlyRepo = { ...calendlyRepository };

  Object.assign(userRepository, fakeUsers.repo);
  Object.assign(doctorApplicationRepository, fakeApps.repo);
  Object.assign(nmcLookupRepository, fakeLookups.repo);
  Object.assign(doctorVerificationRepository, fakeVerifications.repo);
  Object.assign(doctorRepository, fakeDoctors.repo);
  Object.assign(clinicRepository, fakeClinics.repo);
  Object.assign(auditLogRepository, fakeAudits.repo);
  Object.assign(calendlyRepository, fakeCalendly.repo);

  mock.method(clerkGateway, 'getUser', async (id) => ({
    id,
    firstName: 'User',
    lastName: id,
    imageUrl: 'https://img.example/u.png',
    primaryEmailAddressId: 'e1',
    emailAddresses: [{ id: 'e1', emailAddress: `${id}@example.com`, verification: { status: 'verified' } }],
    phoneNumbers: [],
    updatedAt: 1000,
  }));

  mock.method(nmcClient, 'search', async () => ({
    totalCount: 1,
    records: [
      {
        doctorId: 'nmc-1',
        name: 'Asha Rao',
        registrationNumber: 'UP12345',
        registrationYear: 2018,
        stateCode: 'UP',
        councilName: 'Uttar Pradesh Medical Council',
        qualification: 'MBBS',
        qualificationYear: 2017,
        university: null, // omitted by provider -> must surface as NOT_AVAILABLE
        additionalQualifications: [],
        removedStatus: '0',
      },
    ],
  }));

  await userRepository.upsertAdmin('admin_1', { email: 'admin@medibook.test', isEmailVerified: true });
});

afterEach(() => {
  Object.assign(userRepository, origUserRepo);
  Object.assign(doctorApplicationRepository, origAppRepo);
  Object.assign(nmcLookupRepository, origLookupRepo);
  Object.assign(doctorVerificationRepository, origVerificationRepo);
  Object.assign(doctorRepository, origDoctorRepo);
  Object.assign(clinicRepository, origClinicRepo);
  Object.assign(auditLogRepository, origAuditRepo);
  Object.assign(calendlyRepository, origCalendlyRepo);
  mock.restoreAll();
});

const createSubmittedDoctorApp = async (clerkId = 'doc_1', overrides = {}) => {
  await request(app).post('/api/v1/users/onboard').set(bearer(clerkId)).send({ accountType: 'DOCTOR' });
  const payload = { ...fullApplication, ...overrides };
  const createRes = await request(app).post('/api/v1/doctor-applications').set(bearer(clerkId)).send(payload);
  assert.equal(createRes.status, 201);
  const nmcRes = await request(app).post('/api/v1/doctor-verification/nmc-check').set(bearer(clerkId)).send({
    name: payload.personalDetails.fullName,
    registrationNumber: payload.medicalRegistration.registrationNumber,
    registrationYear: payload.medicalRegistration.registrationYear,
    state: payload.medicalRegistration.stateCode,
  });
  assert.equal(nmcRes.status, 200);
  const submitRes = await request(app).post('/api/v1/doctor-applications/submit').set(bearer(clerkId)).send({});
  assert.equal(submitRes.status, 200);
  return submitRes.body.data.application;
};

describe('Phase 4: Admin Verification, Clinics, Approval & Audit Logs', () => {
  it('forbids PATIENT and DOCTOR from accessing admin endpoints', async () => {
    await request(app).post('/api/v1/users/onboard').set(bearer('pat_1')).send({ accountType: 'PATIENT' });
    const appDoc = await createSubmittedDoctorApp('doc_1');

    const patDash = await request(app).get('/api/v1/admin/dashboard').set(bearer('pat_1'));
    assert.equal(patDash.status, 403);

    const docApprove = await request(app)
      .post(`/api/v1/admin/doctor-applications/${appDoc.id}/approve`)
      .set(bearer('doc_1'))
      .send({});
    assert.equal(docApprove.status, 403);
  });

  it('returns dashboard stats, side-by-side NMC comparison with NOT_AVAILABLE, and blocks incomplete approval', async () => {
    await request(app).post('/api/v1/users/onboard').set(bearer('pat_1')).send({ accountType: 'PATIENT' });
    const appDoc = await createSubmittedDoctorApp('doc_1');

    const dash = await request(app).get('/api/v1/admin/dashboard').set(bearer('admin_1'));
    assert.equal(dash.status, 200);
    assert.equal(dash.body.data.stats.totalPatients, 1);
    assert.equal(dash.body.data.stats.totalDoctors, 1);
    assert.equal(dash.body.data.stats.pendingApplications, 1);
    assert.equal(dash.body.data.stats.totalClinics, 1);

    const detail = await request(app)
      .get(`/api/v1/admin/doctor-applications/${appDoc.id}`)
      .set(bearer('admin_1'));
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.nmcComparison.lookupStatus, 'MATCH_FOUND');
    assert.equal(detail.body.data.nmcComparison.nmcReturned.university, 'NOT_AVAILABLE');
    assert.equal(detail.body.data.verification.professional.status, 'PENDING');
    assert.equal(detail.body.data.verification.clinic.status, 'PENDING');
    assert.equal(detail.body.data.verification.gst.status, 'NOT_PROVIDED');

    // Approval must fail with 422 before professional & clinic verifications are completed.
    const premature = await request(app)
      .post(`/api/v1/admin/doctor-applications/${appDoc.id}/approve`)
      .set(bearer('admin_1'))
      .send({});
    assert.equal(premature.status, 422);
    assert.equal(premature.body.code, 'VERIFICATION_INCOMPLETE');
  });

  it('completes full verification -> approval -> public directory -> suspension -> audit logs', async () => {
    const appDoc = await createSubmittedDoctorApp('doc_1');

    // Start review
    const reviewRes = await request(app)
      .patch(`/api/v1/admin/doctor-applications/${appDoc.id}/review`)
      .set(bearer('admin_1'));
    assert.equal(reviewRes.status, 200);
    assert.equal(reviewRes.body.data.application.applicationStatus, 'UNDER_REVIEW');

    // Verify professional registration
    const profRes = await request(app)
      .patch(`/api/v1/admin/doctor-applications/${appDoc.id}/professional-verification`)
      .set(bearer('admin_1'))
      .send({
        status: 'VERIFIED',
        verificationMethod: 'NMC_REGISTER_LOOKUP',
        officialSource: 'NMC Indian Medical Register',
        remarks: 'Matched registration UP-12345',
      });
    assert.equal(profRes.status, 200);
    assert.equal(profRes.body.data.verification.professional.status, 'VERIFIED');

    // Verify clinic
    const clinicRes = await request(app)
      .patch(`/api/v1/admin/doctor-applications/${appDoc.id}/clinic-verification`)
      .set(bearer('admin_1'))
      .send({ status: 'VERIFIED', remarks: 'Verified with CMO Lucknow register' });
    assert.equal(clinicRes.status, 200);
    assert.equal(clinicRes.body.data.verification.clinic.status, 'VERIFIED');

    // Approve (and test idempotency on retry)
    const approve1 = await request(app)
      .post(`/api/v1/admin/doctor-applications/${appDoc.id}/approve`)
      .set(bearer('admin_1'))
      .send({ remarks: 'All checks passed' });
    assert.equal(approve1.status, 200);
    assert.equal(approve1.body.data.application.applicationStatus, 'APPROVED');
    assert.equal(approve1.body.data.doctor.profileStatus, 'PUBLISHED');

    const approve2 = await request(app)
      .post(`/api/v1/admin/doctor-applications/${appDoc.id}/approve`)
      .set(bearer('admin_1'))
      .send({});
    assert.equal(approve2.status, 200);
    assert.equal(fakeDoctors.store.size, 1);

    // Public directory lists the approved doctor
    const pubList = await request(app).get('/api/v1/doctors?city=Lucknow&specialization=Cardio');
    assert.equal(pubList.status, 200);
    assert.equal(pubList.body.data.doctors.length, 1);
    const doctorId = pubList.body.data.doctors[0].id;

    // Suspend doctor -> removed from public directory
    const suspendRes = await request(app)
      .patch(`/api/v1/admin/doctors/${doctorId}/status`)
      .set(bearer('admin_1'))
      .send({ profileStatus: 'SUSPENDED', reason: 'Temporary compliance hold' });
    assert.equal(suspendRes.status, 200);
    assert.equal(suspendRes.body.data.doctor.profileStatus, 'SUSPENDED');

    const pubAfterSuspend = await request(app).get('/api/v1/doctors');
    assert.equal(pubAfterSuspend.body.data.doctors.length, 0);

    const detailAfterSuspend = await request(app).get(`/api/v1/doctors/${doctorId}`);
    assert.equal(detailAfterSuspend.status, 404);

    // Audit logs recorded all administrative actions
    const auditRes = await request(app).get('/api/v1/admin/audit-logs').set(bearer('admin_1'));
    assert.equal(auditRes.status, 200);
    assert.ok(auditRes.body.data.auditLogs.length >= 5);
  });

  it('supports request-information -> doctor edit & resubmit, and optional GST manual verification', async () => {
    const appDoc = await createSubmittedDoctorApp('doc_2', {
      gstDetails: {
        isGSTRegistered: true,
        gstin: '09AAACH7409R1ZZ',
        legalBusinessName: 'Asha Heart Clinic LLP',
      },
    });

    const reqInfo = await request(app)
      .post(`/api/v1/admin/doctor-applications/${appDoc.id}/request-information`)
      .set(bearer('admin_1'))
      .send({ remarks: 'Update clinic street', fieldsToCorrect: ['clinicDetails.address.street'] });
    assert.equal(reqInfo.status, 200);
    assert.equal(reqInfo.body.data.application.applicationStatus, 'NEEDS_INFORMATION');

    const statusView = await request(app).get('/api/v1/doctor-applications/status').set(bearer('doc_2'));
    assert.equal(statusView.status, 200);
    assert.equal(statusView.body.data.status.requestedChanges, 'Update clinic street');
    assert.deepEqual(statusView.body.data.status.fieldsToCorrect, ['clinicDetails.address.street']);

    await request(app)
      .patch('/api/v1/doctor-applications/me')
      .set(bearer('doc_2'))
      .send({ clinicDetails: { address: { street: '22 MG Road' } } });
    await request(app).post('/api/v1/doctor-applications/submit').set(bearer('doc_2')).send({});

    // Admin verifies GST manually
    const gstRes = await request(app)
      .patch(`/api/v1/admin/doctor-applications/${appDoc.id}/gst-verification`)
      .set(bearer('admin_1'))
      .send({
        status: 'VERIFIED',
        registrationStatus: 'Active',
        state: 'Uttar Pradesh',
        remarks: 'Verified on official GST portal',
      });
    assert.equal(gstRes.status, 200);
    assert.equal(gstRes.body.data.verification.gst.status, 'VERIFIED');
  });

  it('supports visiting doctor association with an existing verified clinic and application rejection', async () => {
    const appDoc = await createSubmittedDoctorApp('doc_3');

    // Admin verifies clinic directly
    const clinicsList = await request(app).get('/api/v1/admin/clinics').set(bearer('admin_1'));
    const clinicId = clinicsList.body.data.clinics[0].id;
    const verifyClinic = await request(app)
      .patch(`/api/v1/admin/clinics/${clinicId}/verify`)
      .set(bearer('admin_1'))
      .send({ verificationStatus: 'VERIFIED', remarks: 'Verified' });
    assert.equal(verifyClinic.status, 200);

    // Another doctor associates as VISITING_DOCTOR without own clinic registration
    await request(app).post('/api/v1/users/onboard').set(bearer('doc_visiting')).send({ accountType: 'DOCTOR' });
    const assocRes = await request(app)
      .post('/api/v1/clinics/associations')
      .set(bearer('doc_visiting'))
      .send({ clinicId, relationshipType: 'VISITING_DOCTOR' });
    assert.equal(assocRes.status, 201);
    assert.equal(assocRes.body.data.association.relationshipType, 'VISITING_DOCTOR');
    assert.equal(assocRes.body.data.association.verificationStatus, 'PENDING');

    // Reject doc_3 application with mandatory reason
    const rejectRes = await request(app)
      .post(`/api/v1/admin/doctor-applications/${appDoc.id}/reject`)
      .set(bearer('admin_1'))
      .send({ reason: 'Invalid registration certificate' });
    assert.equal(rejectRes.status, 200);
    assert.equal(rejectRes.body.data.application.applicationStatus, 'REJECTED');
    assert.equal(rejectRes.body.data.application.rejectionReason, 'Invalid registration certificate');
  });
});
