import crypto from 'node:crypto';
import { signSessionToken } from './setup.js';
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createFakeUserRepository } from './helpers/fakeUserRepository.js';
import { createFakeDoctorRepository } from './helpers/fakeDoctorRepositories.js';
import { createFakeAuditLogRepository, createFakeClinicRepository } from './helpers/fakePhase4Repositories.js';
import { createFakeAppointmentRepository, createFakeCalendlyRepository } from './helpers/fakePhase5Repositories.js';
import {
  createFakeConsultationRepository,
  createFakeDocumentStorage,
  createFakeMedicalRecordRepository,
  createFakePrescriptionRepository,
} from './helpers/fakePhase7Repositories.js';

const { default: app } = await import('../src/app.js');
const { userRepository } = await import('../src/modules/users/user.repository.js');
const { doctorRepository } = await import('../src/modules/doctors/doctor.repository.js');
const { clinicRepository } = await import('../src/modules/clinics/clinic.repository.js');
const { auditLogRepository } = await import('../src/modules/auditLogs/auditLog.repository.js');
const { calendlyRepository } = await import('../src/modules/calendly/calendly.repository.js');
const { appointmentRepository } = await import('../src/modules/appointments/appointment.repository.js');
const { medicalRecordRepository } = await import('../src/modules/medicalRecords/medicalRecord.repository.js');
const { documentStorageService } = await import('../src/modules/medicalRecords/services/documentStorage.service.js');
const { prescriptionRepository } = await import('../src/modules/prescriptions/prescription.repository.js');
const { consultationRepository } = await import('../src/modules/consultations/consultation.repository.js');
const { analyticsAggregation } = await import('../src/modules/analytics/analytics.aggregation.js');
const { clerkGateway } = await import('../src/integrations/clerk/clerk.gateway.js');

const bearer = (id) => ({ Authorization: `Bearer ${signSessionToken(id)}` });

let fakeUsers;
let fakeDoctors;
let fakeClinics;
let fakeAudits;
let fakeCalendly;
let fakeAppointments;
let fakeRecords;
let fakeStorage;
let fakePrescriptions;
let fakeConsultations;
let origRepos;

const SAMPLE_PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<<>>\n%%EOF');

beforeEach(async () => {
  fakeUsers = createFakeUserRepository();
  fakeDoctors = createFakeDoctorRepository();
  fakeClinics = createFakeClinicRepository();
  fakeAudits = createFakeAuditLogRepository();
  fakeCalendly = createFakeCalendlyRepository();
  fakeAppointments = createFakeAppointmentRepository();
  fakeRecords = createFakeMedicalRecordRepository();
  fakeStorage = createFakeDocumentStorage();
  fakePrescriptions = createFakePrescriptionRepository();
  fakeConsultations = createFakeConsultationRepository();

  origRepos = {
    user: { ...userRepository },
    doctor: { ...doctorRepository },
    clinic: { ...clinicRepository },
    audit: { ...auditLogRepository },
    calendly: { ...calendlyRepository },
    appt: { ...appointmentRepository },
    record: { ...medicalRecordRepository },
    storage: { ...documentStorageService },
    rx: { ...prescriptionRepository },
    consult: { ...consultationRepository },
    analytics: { ...analyticsAggregation },
  };

  Object.assign(userRepository, fakeUsers.repo);
  Object.assign(doctorRepository, fakeDoctors.repo);
  Object.assign(clinicRepository, fakeClinics.repo);
  Object.assign(auditLogRepository, fakeAudits.repo);
  Object.assign(calendlyRepository, fakeCalendly.repo);
  Object.assign(appointmentRepository, fakeAppointments.repo);
  Object.assign(medicalRecordRepository, fakeRecords.repo);
  Object.assign(documentStorageService, fakeStorage.service);
  Object.assign(prescriptionRepository, fakePrescriptions.repo);
  Object.assign(consultationRepository, fakeConsultations.repo);

  Object.assign(analyticsAggregation, {
    getOverview: async () => ({ totalUsers: 2, totalPatients: 1, totalDoctors: 1, totalAppointments: 1 }),
    getAppointmentAnalytics: async () => ({ total: 1, completionRate: 100, cancellationRate: 0, trend: [] }),
    getUserGrowthAnalytics: async () => ({ registrations: [] }),
    getDoctorAnalytics: async () => ({ bySpecialization: [] }),
    getClinicAnalytics: async () => ({ byVerificationStatus: {} }),
  });

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

  await userRepository.upsertAdmin('admin_1', { email: 'admin@medibook.test', isEmailVerified: true });
});

afterEach(() => {
  Object.assign(userRepository, origRepos.user);
  Object.assign(doctorRepository, origRepos.doctor);
  Object.assign(clinicRepository, origRepos.clinic);
  Object.assign(auditLogRepository, origRepos.audit);
  Object.assign(calendlyRepository, origRepos.calendly);
  Object.assign(appointmentRepository, origRepos.appt);
  Object.assign(medicalRecordRepository, origRepos.record);
  Object.assign(documentStorageService, origRepos.storage);
  Object.assign(prescriptionRepository, origRepos.rx);
  Object.assign(consultationRepository, origRepos.consult);
  Object.assign(analyticsAggregation, origRepos.analytics);
  mock.restoreAll();
});

const seedDoctorAndAppointment = async (docClerkId = 'doc_1', patClerkId = 'pat_1') => {
  await request(app).post('/api/v1/users/onboard').set(bearer(patClerkId)).send({ accountType: 'PATIENT' });
  await request(app).post('/api/v1/users/onboard').set(bearer(docClerkId)).send({ accountType: 'DOCTOR' });

  const patUser = fakeUsers.store.get(patClerkId);
  const docUser = fakeUsers.store.get(docClerkId);

  const doctor = await fakeDoctors.repo.upsertFromApplication(
    {
      _id: crypto.randomUUID(),
      userId: docUser._id,
      personalDetails: { fullName: 'Dr. Mehta', email: docUser.email },
      professionalDetails: { qualification: 'MBBS, MD', specialization: 'General Medicine', experience: 9, medicalSystem: 'MODERN_MEDICINE' },
      medicalRegistration: { councilName: 'DMC', registrationNumber: 'DMC-9001', registrationYear: 2017, stateCode: 'DL' },
      clinicDetails: { clinicName: 'Mehta Clinic', clinicType: 'CLINIC', address: { city: 'Delhi' } },
    },
    docUser._id,
    new Date(),
    {}
  );

  const appointment = await fakeAppointments.repo.create({
    patientId: patUser._id,
    doctorId: doctor._id,
    appointmentTypeId: crypto.randomUUID(),
    provider: 'CALENDLY',
    startAt: new Date(Date.now() + 3600_000),
    endAt: new Date(Date.now() + 5400_000),
    timezone: 'Asia/Kolkata',
    status: 'CONFIRMED',
  });

  return { patUser, docUser, doctor, appointment };
};

describe('Phase 7: Medical Records, Prescriptions, Consultations, Analytics & Security', () => {
  it('encrypts & stores medical records, validates file signatures, enforces sharing/revocation & blocks IDOR/admin', async () => {
    const { doctor } = await seedDoctorAndAppointment('doc_1', 'pat_1');
    await request(app).post('/api/v1/users/onboard').set(bearer('doc_other')).send({ accountType: 'DOCTOR' });

    // Reject invalid file signature (e.g. text masquerading as PDF)
    const badSig = await request(app)
      .post('/api/v1/medical-records')
      .set(bearer('pat_1'))
      .field('title', 'Fake PDF')
      .field('category', 'LAB_REPORT')
      .attach('file', Buffer.from('NOT_A_PDF_FILE'), { filename: 'fake.pdf', contentType: 'application/pdf' });
    assert.equal(badSig.status, 400);
    assert.equal(badSig.body.code, 'INVALID_FILE_SIGNATURE');

    // Valid PDF upload -> encrypted in GridFS, marked UNSCANNED
    const upRes = await request(app)
      .post('/api/v1/medical-records')
      .set(bearer('pat_1'))
      .field('title', 'Blood Test Report')
      .field('category', 'LAB_REPORT')
      .attach('file', SAMPLE_PDF, { filename: 'blood-test.pdf', contentType: 'application/pdf' });
    assert.equal(upRes.status, 201);
    assert.equal(upRes.body.data.record.scanStatus, 'UNSCANNED');
    const recordId = upRes.body.data.record.id;

    // Patient downloads own decrypted file with nosniff header
    const dlPat = await request(app).get(`/api/v1/medical-records/${recordId}/download`).set(bearer('pat_1'));
    assert.equal(dlPat.status, 200);
    assert.equal(dlPat.headers['x-content-type-options'], 'nosniff');
    assert.deepEqual(dlPat.body, SAMPLE_PDF);

    // Admin is blocked from downloading patient medical records by default
    const dlAdmin = await request(app).get(`/api/v1/medical-records/${recordId}/download`).set(bearer('admin_1'));
    assert.equal(dlAdmin.status, 403);

    // Unrelated doctor is blocked (IDOR)
    const dlDocBefore = await request(app).get(`/api/v1/medical-records/${recordId}/download`).set(bearer('doc_1'));
    assert.equal(dlDocBefore.status, 403);

    // Sharing UNSCANNED without allowUnscanned is rejected
    const shareBlocked = await request(app)
      .post(`/api/v1/medical-records/${recordId}/share`)
      .set(bearer('pat_1'))
      .send({ doctorId: String(doctor._id) });
    assert.equal(shareBlocked.status, 422);

    // Share with allowUnscanned -> doctor can download -> revoke -> doctor blocked again
    const shareOk = await request(app)
      .post(`/api/v1/medical-records/${recordId}/share`)
      .set(bearer('pat_1'))
      .send({ doctorId: String(doctor._id), allowUnscanned: true });
    assert.equal(shareOk.status, 201);

    const dlDocAfter = await request(app).get(`/api/v1/medical-records/${recordId}/download`).set(bearer('doc_1'));
    assert.equal(dlDocAfter.status, 200);

    const revokeRes = await request(app)
      .delete(`/api/v1/medical-records/${recordId}/share/${doctor._id}`)
      .set(bearer('pat_1'));
    assert.equal(revokeRes.status, 200);

    const dlDocRevoked = await request(app).get(`/api/v1/medical-records/${recordId}/download`).set(bearer('doc_1'));
    assert.equal(dlDocRevoked.status, 403);
  });

  it('supports prescription draft -> issue -> immutability -> PDF -> amendment -> void', async () => {
    const { appointment } = await seedDoctorAndAppointment('doc_1', 'pat_1');

    const medPayload = {
      appointmentId: String(appointment._id),
      diagnosis: 'Seasonal Viral Fever',
      medicines: [
        { medicineName: 'Paracetamol', strength: '500mg', dose: '1 tablet', frequency: 'TID', duration: '3 days' },
      ],
    };

    // Patient cannot create prescriptions
    const patCreate = await request(app).post('/api/v1/prescriptions').set(bearer('pat_1')).send(medPayload);
    assert.equal(patCreate.status, 403);

    const draftRes = await request(app).post('/api/v1/prescriptions').set(bearer('doc_1')).send(medPayload);
    assert.equal(draftRes.status, 201);
    assert.equal(draftRes.body.data.prescription.status, 'DRAFT');
    const rxId = draftRes.body.data.prescription.id;

    // Patient cannot see unissued draft
    const patDraft = await request(app).get(`/api/v1/prescriptions/${rxId}`).set(bearer('pat_1'));
    assert.equal(patDraft.status, 404);

    // Issue prescription
    const issueRes = await request(app).post(`/api/v1/prescriptions/${rxId}/issue`).set(bearer('doc_1'));
    assert.equal(issueRes.status, 200);
    assert.equal(issueRes.body.data.prescription.status, 'ISSUED');
    assert.match(issueRes.body.data.prescription.prescriptionNumber, /^MB-RX-\d{4}-\d{6}$/);

    // Issued prescription is immutable
    const editIssued = await request(app)
      .patch(`/api/v1/prescriptions/${rxId}`)
      .set(bearer('doc_1'))
      .send({ diagnosis: 'Changed' });
    assert.equal(editIssued.status, 409);
    assert.equal(editIssued.body.code, 'PRESCRIPTION_IMMUTABLE');

    // Patient downloads PDF
    const pdfRes = await request(app).get(`/api/v1/prescriptions/${rxId}/pdf`).set(bearer('pat_1'));
    assert.equal(pdfRes.status, 200);
    assert.equal(pdfRes.headers['content-type'], 'application/pdf');
    assert.equal(pdfRes.body.subarray(0, 5).toString('ascii'), '%PDF-');

    // Amendment creates v2 and marks v1 AMENDED
    const amendRes = await request(app)
      .post(`/api/v1/prescriptions/${rxId}/amend`)
      .set(bearer('doc_1'))
      .send({ reason: 'Adjusted duration to 5 days' });
    assert.equal(amendRes.status, 201);
    assert.equal(amendRes.body.data.prescription.version, 2);
    assert.equal(amendRes.body.data.prescription.previousPrescriptionId, rxId);

    // Void v2
    const voidRes = await request(app)
      .post(`/api/v1/prescriptions/${amendRes.body.data.prescription.id}/void`)
      .set(bearer('doc_1'))
      .send({ reason: 'Issued in error' });
    assert.equal(voidRes.status, 200);
    assert.equal(voidRes.body.data.prescription.status, 'VOIDED');
  });

  it('manages consultation records, admin analytics RBAC, X-Request-Id & NoSQL sanitization', async () => {
    const { appointment } = await seedDoctorAndAppointment('doc_1', 'pat_1');

    const consultRes = await request(app)
      .post('/api/v1/consultations')
      .set(bearer('doc_1'))
      .send({ appointmentId: String(appointment._id), notes: 'Patient stable' });
    assert.equal(consultRes.status, 201);
    assert.ok(consultRes.headers['x-request-id']);
    const consultId = consultRes.body.data.consultation.id;

    const completeRes = await request(app)
      .post(`/api/v1/consultations/${consultId}/complete`)
      .set(bearer('doc_1'));
    assert.equal(completeRes.status, 200);
    assert.equal(completeRes.body.data.consultation.status, 'COMPLETED');

    const patConsults = await request(app).get('/api/v1/consultations/my').set(bearer('pat_1'));
    assert.equal(patConsults.status, 200);
    assert.equal(patConsults.body.data.consultations.length, 1);

    // Admin analytics RBAC & date-range guard
    const patAnalytics = await request(app).get('/api/v1/admin/analytics/overview').set(bearer('pat_1'));
    assert.equal(patAnalytics.status, 403);

    const adminAnalytics = await request(app).get('/api/v1/admin/analytics/overview').set(bearer('admin_1'));
    assert.equal(adminAnalytics.status, 200);
    assert.equal(adminAnalytics.body.data.overview.totalUsers, 2);

    const badRange = await request(app)
      .get('/api/v1/admin/analytics/appointments?from=2025-01-01&to=2026-12-31')
      .set(bearer('admin_1'));
    assert.equal(badRange.status, 400);

    // NoSQL operator key `$ne` is stripped before Zod validation
    const nosqlRes = await request(app)
      .post('/api/v1/users/onboard')
      .set(bearer('pat_nosql'))
      .send({ accountType: 'PATIENT', $where: 'malicious' });
    assert.equal(nosqlRes.status, 201);
  });
});
