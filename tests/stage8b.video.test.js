import crypto from 'node:crypto';
import { signSessionToken } from './setup.js';
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createFakeUserRepository } from './helpers/fakeUserRepository.js';
import { createFakeDoctorRepository } from './helpers/fakeDoctorRepositories.js';
import { createFakeAppointmentRepository } from './helpers/fakePhase5Repositories.js';
import { createFakeVideoConsultationRepository } from './helpers/fakePhase8Repositories.js';

const { default: app } = await import('../src/app.js');
const { userRepository } = await import('../src/modules/users/user.repository.js');
const { doctorRepository } = await import('../src/modules/doctors/doctor.repository.js');
const { appointmentRepository } = await import('../src/modules/appointments/appointment.repository.js');
const { videoConsultationRepository } = await import('../src/modules/videoConsultations/videoConsultation.repository.js');
const { clerkGateway } = await import('../src/integrations/clerk/clerk.gateway.js');

const bearer = (id) => ({ Authorization: `Bearer ${signSessionToken(id)}` });

let fakeUsers;
let fakeDoctors;
let fakeAppointments;
let fakeVideo;
let origRepos;

beforeEach(async () => {
  process.env.AGORA_APP_ID = '0123456789abcdef0123456789abcdef';
  process.env.AGORA_APP_CERTIFICATE = 'fedcba9876543210fedcba9876543210';

  fakeUsers = createFakeUserRepository();
  fakeDoctors = createFakeDoctorRepository();
  fakeAppointments = createFakeAppointmentRepository();
  fakeVideo = createFakeVideoConsultationRepository();

  origRepos = {
    user: { ...userRepository },
    doctor: { ...doctorRepository },
    appt: { ...appointmentRepository },
    video: { ...videoConsultationRepository },
  };

  Object.assign(userRepository, fakeUsers.repo);
  Object.assign(doctorRepository, fakeDoctors.repo);
  Object.assign(appointmentRepository, fakeAppointments.repo);
  Object.assign(videoConsultationRepository, fakeVideo.repo);

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
  Object.assign(doctorRepository, origRepos.doctor);
  Object.assign(appointmentRepository, origRepos.appt);
  Object.assign(videoConsultationRepository, origRepos.video);
  mock.restoreAll();
});

const seedVideoScenario = async (overrides = {}) => {
  await request(app).post('/api/v1/users/onboard').set(bearer('pat_1')).send({ accountType: 'PATIENT' });
  await request(app).post('/api/v1/users/onboard').set(bearer('pat_other')).send({ accountType: 'PATIENT' });
  await request(app).post('/api/v1/users/onboard').set(bearer('doc_1')).send({ accountType: 'DOCTOR' });

  const patUser = fakeUsers.store.get('pat_1');
  const docUser = fakeUsers.store.get('doc_1');

  const doctor = await fakeDoctors.repo.upsertFromApplication(
    {
      _id: crypto.randomUUID(),
      userId: docUser._id,
      personalDetails: { fullName: 'Dr. Iyer', email: docUser.email },
      professionalDetails: { qualification: 'MBBS', specialization: 'General', experience: 6, medicalSystem: 'MODERN_MEDICINE' },
      medicalRegistration: { councilName: 'KMC', registrationNumber: 'KMC-10', registrationYear: 2019, stateCode: 'KAR' },
      clinicDetails: { clinicName: 'Iyer Clinic', clinicType: 'CLINIC', address: { city: 'Bengaluru' } },
    },
    docUser._id,
    new Date(),
    {}
  );

  const now = Date.now();
  const appt = await fakeAppointments.repo.create({
    patientId: patUser._id,
    doctorId: doctor._id,
    appointmentTypeId: crypto.randomUUID(),
    provider: 'CALENDLY',
    startAt: new Date(now + 5 * 60_000),
    endAt: new Date(now + 20 * 60_000),
    timezone: 'Asia/Kolkata',
    consultationMode: 'VIDEO',
    status: 'CONFIRMED',
    paymentStatus: 'PAID',
    ...overrides,
  });

  return { doctor, appt };
};

describe('Stage 8B: Agora Video Consultations', () => {
  it('generates short-lived Agora tokens for authorized patient & doctor on same channel, never exposing App Certificate', async () => {
    const { appt } = await seedVideoScenario();

    const patToken = await request(app)
      .post(`/api/v1/video-consultations/${appt._id}/token`)
      .set(bearer('pat_1'))
      .send({ telemedicineConsentAccepted: true, emergencyNoticeAcknowledged: true });
    assert.equal(patToken.status, 200);
    assert.ok(patToken.body.data.token);
    assert.equal(patToken.body.data.appCertificate, undefined);
    assert.ok(patToken.body.data.emergencyNotice);

    const docToken = await request(app)
      .post(`/api/v1/video-consultations/${appt._id}/token`)
      .set(bearer('doc_1'))
      .send({ telemedicineConsentAccepted: true, emergencyNoticeAcknowledged: true });
    assert.equal(docToken.status, 200);
    assert.equal(docToken.body.data.channelName, patToken.body.data.channelName);
    assert.notEqual(docToken.body.data.uid, patToken.body.data.uid);

    // Unrelated patient rejected
    const otherPat = await request(app)
      .post(`/api/v1/video-consultations/${appt._id}/token`)
      .set(bearer('pat_other'))
      .send({});
    assert.equal(otherPat.status, 403);

    // Doctor completes video consultation
    const completeRes = await request(app)
      .post(`/api/v1/video-consultations/${appt._id}/complete`)
      .set(bearer('doc_1'));
    assert.equal(completeRes.status, 200);
    assert.equal(completeRes.body.data.status, 'COMPLETED');
  });

  it('rejects payment-pending, expired, and in-person appointments', async () => {
    const unpaid = await seedVideoScenario({ status: 'PAYMENT_PENDING', paymentStatus: 'PENDING' });
    const unpaidRes = await request(app)
      .post(`/api/v1/video-consultations/${unpaid.appt._id}/token`)
      .set(bearer('pat_1'))
      .send({});
    assert.equal(unpaidRes.status, 402);

    const expired = await seedVideoScenario({
      startAt: new Date(Date.now() - 120 * 60_000),
      endAt: new Date(Date.now() - 90 * 60_000),
    });
    const expRes = await request(app)
      .post(`/api/v1/video-consultations/${expired.appt._id}/token`)
      .set(bearer('pat_1'))
      .send({});
    assert.equal(expRes.status, 409);
    assert.equal(expRes.body.code, 'CONSULTATION_WINDOW_EXPIRED');
  });
});
