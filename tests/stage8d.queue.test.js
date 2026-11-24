import crypto from 'node:crypto';
import { signSessionToken } from './setup.js';
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createFakeUserRepository } from './helpers/fakeUserRepository.js';
import { createFakeDoctorRepository } from './helpers/fakeDoctorRepositories.js';
import { createFakeAppointmentRepository } from './helpers/fakePhase5Repositories.js';
import { createFakeQueueRepository } from './helpers/fakePhase8Repositories.js';

const { default: app } = await import('../src/app.js');
const { userRepository } = await import('../src/modules/users/user.repository.js');
const { doctorRepository } = await import('../src/modules/doctors/doctor.repository.js');
const { appointmentRepository } = await import('../src/modules/appointments/appointment.repository.js');
const { queueRepository } = await import('../src/modules/queueManagement/queue.repository.js');
const { clerkGateway } = await import('../src/integrations/clerk/clerk.gateway.js');

const bearer = (id) => ({ Authorization: `Bearer ${signSessionToken(id)}` });

let fakeUsers;
let fakeDoctors;
let fakeAppointments;
let fakeQueues;
let origRepos;

beforeEach(async () => {
  fakeUsers = createFakeUserRepository();
  fakeDoctors = createFakeDoctorRepository();
  fakeAppointments = createFakeAppointmentRepository();
  fakeQueues = createFakeQueueRepository();

  origRepos = {
    user: { ...userRepository },
    doctor: { ...doctorRepository },
    appt: { ...appointmentRepository },
    queue: { ...queueRepository },
  };

  Object.assign(userRepository, fakeUsers.repo);
  Object.assign(doctorRepository, fakeDoctors.repo);
  Object.assign(appointmentRepository, fakeAppointments.repo);
  Object.assign(queueRepository, fakeQueues.repo);

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
  Object.assign(queueRepository, origRepos.queue);
  mock.restoreAll();
});

describe('Stage 8D: Live Clinic Queue Management', () => {
  it('supports opening queue, in-person check-in, token isolation, call-next, start, complete, and pause/close', async () => {
    await request(app).post('/api/v1/users/onboard').set(bearer('pat_1')).send({ accountType: 'PATIENT' });
    await request(app).post('/api/v1/users/onboard').set(bearer('pat_2')).send({ accountType: 'PATIENT' });
    await request(app).post('/api/v1/users/onboard').set(bearer('doc_1')).send({ accountType: 'DOCTOR' });

    const pat1 = fakeUsers.store.get('pat_1');
    const pat2 = fakeUsers.store.get('pat_2');
    const docUser = fakeUsers.store.get('doc_1');

    const doctor = await fakeDoctors.repo.upsertFromApplication(
      {
        _id: crypto.randomUUID(),
        userId: docUser._id,
        personalDetails: { fullName: 'Dr. Verma', email: docUser.email },
        professionalDetails: { qualification: 'MBBS', specialization: 'ENT', experience: 11, medicalSystem: 'MODERN_MEDICINE' },
        medicalRegistration: { councilName: 'DMC', registrationNumber: 'DMC-33', registrationYear: 2014, stateCode: 'DL' },
        clinicDetails: { clinicName: 'Verma ENT', clinicType: 'CLINIC', address: { city: 'Delhi' } },
      },
      docUser._id,
      new Date(),
      {}
    );

    const appt1 = await fakeAppointments.repo.create({
      patientId: pat1._id,
      doctorId: doctor._id,
      appointmentTypeId: crypto.randomUUID(),
      provider: 'CALENDLY',
      startAt: new Date(),
      endAt: new Date(Date.now() + 900_000),
      consultationMode: 'IN_PERSON',
      status: 'CONFIRMED',
    });

    const appt2 = await fakeAppointments.repo.create({
      patientId: pat2._id,
      doctorId: doctor._id,
      appointmentTypeId: crypto.randomUUID(),
      provider: 'CALENDLY',
      startAt: new Date(),
      endAt: new Date(Date.now() + 1800_000),
      consultationMode: 'IN_PERSON',
      status: 'CONFIRMED',
    });

    const videoAppt = await fakeAppointments.repo.create({
      patientId: pat1._id,
      doctorId: doctor._id,
      appointmentTypeId: crypto.randomUUID(),
      provider: 'CALENDLY',
      startAt: new Date(),
      endAt: new Date(Date.now() + 2700_000),
      consultationMode: 'VIDEO',
      status: 'CONFIRMED',
    });

    // Doctor opens queue
    const openRes = await request(app)
      .post('/api/v1/doctor/queues')
      .set(bearer('doc_1'))
      .send({ averageConsultationMinutes: 10 });
    assert.equal(openRes.status, 201);
    const queueId = openRes.body.data.session.id;

    // Video appointment cannot enter in-person queue
    const videoCheckIn = await request(app)
      .post('/api/v1/queues/check-in')
      .set(bearer('pat_1'))
      .send({ appointmentId: String(videoAppt._id) });
    assert.equal(videoCheckIn.status, 409);

    // Patient 1 & 2 check in -> tokens 1 & 2
    const ci1 = await request(app)
      .post('/api/v1/queues/check-in')
      .set(bearer('pat_1'))
      .send({ appointmentId: String(appt1._id) });
    assert.equal(ci1.status, 201);
    assert.equal(ci1.body.data.entry.tokenNumber, 1);

    // Duplicate check-in rejected
    const ciDup = await request(app)
      .post('/api/v1/queues/check-in')
      .set(bearer('pat_1'))
      .send({ appointmentId: String(appt1._id) });
    assert.equal(ciDup.status, 409);

    const ci2 = await request(app)
      .post('/api/v1/queues/check-in')
      .set(bearer('pat_2'))
      .send({ appointmentId: String(appt2._id) });
    assert.equal(ci2.status, 201);
    assert.equal(ci2.body.data.entry.tokenNumber, 2);

    // Patient 2 position shows 1 patient ahead, 10 min estimate
    const pos2 = await request(app)
      .get(`/api/v1/queues/my-position?appointmentId=${appt2._id}`)
      .set(bearer('pat_2'));
    assert.equal(pos2.status, 200);
    assert.equal(pos2.body.data.position.patientsAhead, 1);
    assert.equal(pos2.body.data.position.estimatedWaitMinutes, 10);
    assert.equal(pos2.body.data.position.isEstimate, true);

    // Patient 1 cannot view Patient 2's queue position
    const otherPos = await request(app)
      .get(`/api/v1/queues/my-position?appointmentId=${appt2._id}`)
      .set(bearer('pat_1'));
    assert.equal(otherPos.status, 403);

    // Doctor calls next -> token 1 CALLED -> start -> complete
    const call1 = await request(app)
      .patch(`/api/v1/doctor/queues/${queueId}/call-next`)
      .set(bearer('doc_1'));
    assert.equal(call1.status, 200);
    assert.equal(call1.body.data.entry.tokenNumber, 1);
    const entry1Id = call1.body.data.entry.id;

    const start1 = await request(app)
      .patch(`/api/v1/doctor/queues/${queueId}/entries/${entry1Id}/start`)
      .set(bearer('doc_1'));
    assert.equal(start1.status, 200);
    assert.equal(start1.body.data.entry.status, 'IN_CONSULTATION');

    const comp1 = await request(app)
      .patch(`/api/v1/doctor/queues/${queueId}/entries/${entry1Id}/complete`)
      .set(bearer('doc_1'));
    assert.equal(comp1.status, 200);
    assert.equal(comp1.body.data.entry.status, 'COMPLETED');

    // Pause and close queue
    const pauseRes = await request(app).patch(`/api/v1/doctor/queues/${queueId}/pause`).set(bearer('doc_1'));
    assert.equal(pauseRes.body.data.session.status, 'PAUSED');

    const closeRes = await request(app).patch(`/api/v1/doctor/queues/${queueId}/close`).set(bearer('doc_1'));
    assert.equal(closeRes.body.data.session.status, 'CLOSED');
  });
});
