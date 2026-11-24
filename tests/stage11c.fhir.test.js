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
const { patientRepository } = await import('../src/modules/patients/patient.repository.js');
const { prescriptionRepository } = await import('../src/modules/prescriptions/prescription.repository.js');
const { medicalRecordRepository } = await import('../src/modules/medicalRecords/medicalRecord.repository.js');
const { abdmRepository } = await import('../src/modules/abdm/abdm.repository.js');
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

describe('Stage 11C - FHIR R4 Interoperability & Validation', () => {
  it('converts Prescription to valid ABDM FHIR Bundle, blocks unauthorized patient, and rejects malformed bundles', async () => {
    const pat1 = await fakeUsers.repo.create({
      clerkUserId: 'clerk_fhir_pat1',
      email: 'fhirpat1@test.local',
      firstName: 'Aarav',
      lastName: 'Mehta',
      role: 'PATIENT',
      accountStatus: 'ACTIVE',
      onboardingStatus: 'COMPLETED',
    });
    const pat2 = await fakeUsers.repo.create({
      clerkUserId: 'clerk_fhir_pat2',
      email: 'fhirpat2@test.local',
      role: 'PATIENT',
      accountStatus: 'ACTIVE',
      onboardingStatus: 'COMPLETED',
    });
    const docUser = await fakeUsers.repo.create({
      clerkUserId: 'clerk_fhir_doc',
      email: 'fhirdoc@test.local',
      role: 'DOCTOR',
      accountStatus: 'ACTIVE',
      onboardingStatus: 'COMPLETED',
    });
    const doctor = await fakeDoctors.repo.upsertFromApplication(
      {
        _id: 'app-fhir-1',
        userId: docUser._id,
        personalDetails: { fullName: 'Dr. Vikram Seth', email: docUser.email },
        professionalDetails: { qualification: 'MBBS', specialization: 'General', experience: 5, medicalSystem: 'MODERN_MEDICINE' },
        medicalRegistration: { councilName: 'NMC', registrationNumber: 'NMC-FHIR-1', registrationYear: 2019, stateCode: 'DEL' },
        clinicDetails: { clinicName: 'Seth Clinic', clinicType: 'CLINIC', address: { city: 'Delhi' } },
      },
      docUser._id,
      new Date(),
      {}
    );
    const clinic = await fakeClinics.repo.create({
      clinicName: 'Seth Clinic',
      clinicType: 'CLINIC',
      verificationStatus: 'VERIFIED',
      address: { city: 'Delhi', state: 'Delhi', pincode: '110001' },
    });

    mock.method(patientRepository, 'findByUserId', async () => ({
      userId: pat1._id,
      gender: 'MALE',
      dateOfBirth: new Date('1992-05-10'),
    }));
    mock.method(prescriptionRepository, 'findById', async (id) =>
      id === 'rx-fhir-1'
        ? {
            _id: 'rx-fhir-1',
            prescriptionNumber: 'MB-RX-00001',
            patientId: pat1._id,
            doctorId: doctor._id,
            clinicId: clinic._id,
            status: 'ISSUED',
            issuedAt: new Date(),
            medicines: [
              {
                medicineName: 'Paracetamol',
                strength: '500mg',
                dose: '1 tablet',
                frequency: 'TID',
                duration: '5 days',
              },
            ],
          }
        : null
    );
    mock.method(medicalRecordRepository, 'findById', async (id) =>
      id === 'rec-diag-1'
        ? {
            _id: 'rec-diag-1',
            patientId: pat1._id,
            title: 'CBC Blood Report',
            category: 'LAB_REPORT',
            description: 'Hemoglobin 14.2 g/dL',
            uploadedAt: new Date(),
          }
        : null
    );

    // Patient 1 converts prescription
    const rxRes = await request(app)
      .post('/api/v1/interoperability/fhir/convert')
      .set(bearer(pat1.clerkUserId))
      .send({ recordSourceType: 'PRESCRIPTION', recordId: 'rx-fhir-1' });
    assert.equal(rxRes.status, 200);
    assert.equal(rxRes.body.data.validation.valid, true);
    assert.equal(rxRes.body.data.bundle.resourceType, 'Bundle');
    assert.equal(rxRes.body.data.bundle.type, 'document');
    assert.equal(rxRes.body.data.bundle.entry[0].resource.resourceType, 'Composition');

    // DiagnosticReport conversion via GET /records/:id?type=MEDICAL_RECORD
    const diagRes = await request(app)
      .get('/api/v1/interoperability/fhir/records/rec-diag-1?type=MEDICAL_RECORD')
      .set(bearer(pat1.clerkUserId));
    assert.equal(diagRes.status, 200);
    assert.ok(diagRes.body.data.bundle.entry.some((e) => e.resource.resourceType === 'DiagnosticReport'));

    // Cross-patient access rejected
    const isoRes = await request(app)
      .get('/api/v1/interoperability/fhir/records/rec-diag-1?type=MEDICAL_RECORD')
      .set(bearer(pat2.clerkUserId));
    assert.equal(isoRes.status, 403);

    // Invalid FHIR bundle rejected (missing coding system & unresolved reference)
    const badRes = await request(app)
      .post('/api/v1/interoperability/fhir/validate')
      .set(bearer(pat1.clerkUserId))
      .send({
        resourceType: 'Bundle',
        type: 'document',
        timestamp: new Date().toISOString(),
        entry: [
          {
            fullUrl: 'urn:uuid:comp-1',
            resource: {
              resourceType: 'Composition',
              meta: { profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/Composition'] },
              status: 'final',
              type: { coding: [{ code: '123' }] },
              subject: { reference: 'urn:uuid:missing-patient' },
              date: new Date().toISOString(),
              author: [{ reference: 'urn:uuid:missing-patient' }],
              title: 'Bad',
            },
          },
        ],
      });
    assert.equal(badRes.status, 422);
    assert.equal(badRes.body.data.valid, false);
    assert.ok(badRes.body.data.errors.length >= 2);
  });
});
