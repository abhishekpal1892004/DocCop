import crypto from 'node:crypto';
import { signSessionToken } from './setup.js';
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createFakeUserRepository } from './helpers/fakeUserRepository.js';
import { createFakeDoctorRepository } from './helpers/fakeDoctorRepositories.js';
import { createFakeAuditLogRepository } from './helpers/fakePhase4Repositories.js';
import { createFakeAppointmentRepository } from './helpers/fakePhase5Repositories.js';
import { createFakeReviewRepository } from './helpers/fakePhase8Repositories.js';

const { default: app } = await import('../src/app.js');
const { userRepository } = await import('../src/modules/users/user.repository.js');
const { doctorRepository } = await import('../src/modules/doctors/doctor.repository.js');
const { auditLogRepository } = await import('../src/modules/auditLogs/auditLog.repository.js');
const { appointmentRepository } = await import('../src/modules/appointments/appointment.repository.js');
const { reviewRepository } = await import('../src/modules/reviews/review.repository.js');
const { clerkGateway } = await import('../src/integrations/clerk/clerk.gateway.js');

const bearer = (id) => ({ Authorization: `Bearer ${signSessionToken(id)}` });

let fakeUsers;
let fakeDoctors;
let fakeAudits;
let fakeAppointments;
let fakeReviews;
let origRepos;

beforeEach(async () => {
  fakeUsers = createFakeUserRepository();
  fakeDoctors = createFakeDoctorRepository();
  fakeAudits = createFakeAuditLogRepository();
  fakeAppointments = createFakeAppointmentRepository();
  fakeReviews = createFakeReviewRepository();

  origRepos = {
    user: { ...userRepository },
    doctor: { ...doctorRepository },
    audit: { ...auditLogRepository },
    appt: { ...appointmentRepository },
    review: { ...reviewRepository },
  };

  Object.assign(userRepository, fakeUsers.repo);
  Object.assign(doctorRepository, fakeDoctors.repo);
  Object.assign(auditLogRepository, fakeAudits.repo);
  Object.assign(appointmentRepository, fakeAppointments.repo);
  Object.assign(reviewRepository, fakeReviews.repo);

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

  await userRepository.upsertAdmin('admin_1', { email: 'admin@medibook.test', isEmailVerified: true });
});

afterEach(() => {
  Object.assign(userRepository, origRepos.user);
  Object.assign(doctorRepository, origRepos.doctor);
  Object.assign(auditLogRepository, origRepos.audit);
  Object.assign(appointmentRepository, origRepos.appt);
  Object.assign(reviewRepository, origRepos.review);
  mock.restoreAll();
});

describe('Stage 8C: Doctor Reviews, Ratings & Moderation', () => {
  it('allows only completed-appointment patients to review, aggregates ratings, and supports report + moderation', async () => {
    await request(app).post('/api/v1/users/onboard').set(bearer('pat_1')).send({ accountType: 'PATIENT' });
    await request(app).post('/api/v1/users/onboard').set(bearer('doc_1')).send({ accountType: 'DOCTOR' });

    const patUser = fakeUsers.store.get('pat_1');
    const docUser = fakeUsers.store.get('doc_1');

    const doctor = await fakeDoctors.repo.upsertFromApplication(
      {
        _id: crypto.randomUUID(),
        userId: docUser._id,
        personalDetails: { fullName: 'Dr. Nair', email: docUser.email },
        professionalDetails: { qualification: 'MBBS', specialization: 'Dermatology', experience: 5, medicalSystem: 'MODERN_MEDICINE' },
        medicalRegistration: { councilName: 'KMC', registrationNumber: 'KMC-99', registrationYear: 2019, stateCode: 'KAR' },
        clinicDetails: { clinicName: 'Nair Clinic', clinicType: 'CLINIC', address: { city: 'Kochi' } },
      },
      docUser._id,
      new Date(),
      {}
    );

    const confirmedAppt = await fakeAppointments.repo.create({
      patientId: patUser._id,
      doctorId: doctor._id,
      appointmentTypeId: crypto.randomUUID(),
      provider: 'CALENDLY',
      startAt: new Date(),
      endAt: new Date(Date.now() + 900_000),
      status: 'CONFIRMED',
    });

    // Cannot review a non-completed appointment
    const notCompleted = await request(app)
      .post(`/api/v1/doctors/${doctor._id}/reviews`)
      .set(bearer('pat_1'))
      .send({ appointmentId: String(confirmedAppt._id), rating: 5, reviewText: 'Great' });
    assert.equal(notCompleted.status, 409);

    const completedAppt = await fakeAppointments.repo.create({
      patientId: patUser._id,
      doctorId: doctor._id,
      appointmentTypeId: crypto.randomUUID(),
      provider: 'CALENDLY',
      startAt: new Date(Date.now() - 3600_000),
      endAt: new Date(Date.now() - 2700_000),
      status: 'COMPLETED',
    });

    const revRes = await request(app)
      .post(`/api/v1/doctors/${doctor._id}/reviews`)
      .set(bearer('pat_1'))
      .send({ appointmentId: String(completedAppt._id), rating: 5, reviewText: 'Very thorough' });
    assert.equal(revRes.status, 201);
    const reviewId = revRes.body.data.review.id;

    // Duplicate review for same appointment rejected
    const dupRes = await request(app)
      .post(`/api/v1/doctors/${doctor._id}/reviews`)
      .set(bearer('pat_1'))
      .send({ appointmentId: String(completedAppt._id), rating: 4 });
    assert.equal(dupRes.status, 409);

    // Public reviews & rating summary
    const pubRes = await request(app).get(`/api/v1/doctors/${doctor._id}/reviews`);
    assert.equal(pubRes.status, 200);
    assert.equal(pubRes.body.data.ratingSummary.averageRating, 5);
    assert.equal(pubRes.body.data.ratingSummary.totalReviews, 1);

    // Report review -> FLAGGED -> excluded from public ratings
    const repRes = await request(app)
      .post(`/api/v1/reviews/${reviewId}/report`)
      .set(bearer('doc_1'))
      .send({ reason: 'Spam' });
    assert.equal(repRes.status, 200);
    assert.equal(repRes.body.data.review.moderationStatus, 'FLAGGED');

    const pubFlagged = await request(app).get(`/api/v1/doctors/${doctor._id}/reviews`);
    assert.equal(pubFlagged.body.data.ratingSummary.totalReviews, 0);

    // Admin restores review -> APPROVED
    const modRes = await request(app)
      .patch(`/api/v1/admin/reviews/${reviewId}/moderate`)
      .set(bearer('admin_1'))
      .send({ moderationStatus: 'APPROVED', remarks: 'Valid patient feedback' });
    assert.equal(modRes.status, 200);
    assert.equal(modRes.body.data.review.moderationStatus, 'APPROVED');
  });
});
