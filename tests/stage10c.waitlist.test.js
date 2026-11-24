import crypto from 'node:crypto';
import { signSessionToken } from './setup.js';
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createFakeUserRepository } from './helpers/fakeUserRepository.js';
import { createFakeDoctorRepository } from './helpers/fakeDoctorRepositories.js';
import {
  createFakeAppointmentRepository,
  createFakeCalendlyRepository,
  createFakeCalendlyWebhookRepository,
} from './helpers/fakePhase5Repositories.js';
import { createFakeNotificationRepository } from './helpers/fakePhase6Repositories.js';
import { createFakeWaitlistRepository } from './helpers/fakePhase10Repositories.js';

const { default: app } = await import('../src/app.js');
const { userRepository } = await import('../src/modules/users/user.repository.js');
const { doctorRepository } = await import('../src/modules/doctors/doctor.repository.js');
const { calendlyRepository } = await import('../src/modules/calendly/calendly.repository.js');
const { appointmentRepository } = await import('../src/modules/appointments/appointment.repository.js');
const { calendlyWebhookRepository } = await import('../src/modules/webhooks/calendlyWebhook.repository.js');
const { notificationRepository } = await import('../src/modules/notifications/notification.repository.js');
const { waitlistRepository } = await import('../src/modules/waitlist/waitlist.repository.js');
const { clerkGateway } = await import('../src/integrations/clerk/clerk.gateway.js');
const { calendlyClient } = await import('../src/integrations/calendly/calendly.client.js');
const { calendlyTokenService } = await import('../src/integrations/calendly/calendly.token.service.js');

const bearer = (id) => ({ Authorization: `Bearer ${signSessionToken(id)}` });

let fakeUsers;
let fakeDoctors;
let fakeCalendly;
let fakeAppointments;
let fakeWebhooks;
let fakeNotifications;
let fakeWaitlist;
let origRepos;

beforeEach(async () => {
  process.env.CALENDLY_WEBHOOK_SIGNING_KEY = 'test-webhook-signing-key';

  fakeUsers = createFakeUserRepository();
  fakeDoctors = createFakeDoctorRepository();
  fakeCalendly = createFakeCalendlyRepository();
  fakeAppointments = createFakeAppointmentRepository();
  fakeWebhooks = createFakeCalendlyWebhookRepository();
  fakeNotifications = createFakeNotificationRepository();
  fakeWaitlist = createFakeWaitlistRepository();

  origRepos = {
    user: { ...userRepository },
    doctor: { ...doctorRepository },
    calendly: { ...calendlyRepository },
    appt: { ...appointmentRepository },
    webhook: { ...calendlyWebhookRepository },
    notif: { ...notificationRepository },
    waitlist: { ...waitlistRepository },
  };

  Object.assign(userRepository, fakeUsers.repo);
  Object.assign(doctorRepository, fakeDoctors.repo);
  Object.assign(calendlyRepository, fakeCalendly.repo);
  Object.assign(appointmentRepository, fakeAppointments.repo);
  Object.assign(calendlyWebhookRepository, fakeWebhooks.repo);
  Object.assign(notificationRepository, fakeNotifications.repo);
  Object.assign(waitlistRepository, fakeWaitlist.repo);

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
  Object.assign(calendlyRepository, origRepos.calendly);
  Object.assign(appointmentRepository, origRepos.appt);
  Object.assign(calendlyWebhookRepository, origRepos.webhook);
  Object.assign(notificationRepository, origRepos.notif);
  Object.assign(waitlistRepository, origRepos.waitlist);
  mock.restoreAll();
});

describe('Stage 10C: Smart Appointment Waitlist', () => {
  it('creates waitlist offer on cancellation after Calendly revalidation and books on patient acceptance', async () => {
    await request(app).post('/api/v1/users/onboard').set(bearer('pat_1')).send({ accountType: 'PATIENT' });
    await request(app).post('/api/v1/users/onboard').set(bearer('pat_wait')).send({ accountType: 'PATIENT' });
    await request(app).post('/api/v1/users/onboard').set(bearer('doc_1')).send({ accountType: 'DOCTOR' });

    const pat1 = fakeUsers.store.get('pat_1');
    const docUser = fakeUsers.store.get('doc_1');

    const doctor = await fakeDoctors.repo.upsertFromApplication(
      {
        _id: crypto.randomUUID(),
        userId: docUser._id,
        personalDetails: { fullName: 'Dr. Sen', email: docUser.email },
        professionalDetails: { qualification: 'MBBS', specialization: 'Neurology', experience: 8, medicalSystem: 'MODERN_MEDICINE' },
        medicalRegistration: { councilName: 'WBMC', registrationNumber: 'WB-101', registrationYear: 2017, stateCode: 'WES' },
        clinicDetails: { clinicName: 'Sen Clinic', clinicType: 'CLINIC', address: { city: 'Kolkata' } },
      },
      docUser._id,
      new Date(),
      {}
    );

    await fakeCalendly.repo.upsertConnection(doctor._id, {
      doctorId: doctor._id,
      doctorUserId: docUser._id,
      calendlyUserUri: 'https://api.calendly.com/users/DOC1',
      accessTokenEncrypted: calendlyTokenService.encrypt('tok'),
      connectionStatus: 'CONNECTED',
    });

    const apptType = await fakeCalendly.repo.upsertAppointmentType(doctor._id, 'https://api.calendly.com/event_types/ET1', {
      doctorId: doctor._id,
      calendlyEventTypeUri: 'https://api.calendly.com/event_types/ET1',
      name: 'Consult',
      durationMinutes: 15,
      consultationFee: 500,
      consultationMode: 'IN_PERSON',
      isActive: true,
    });

    const slotIso = new Date(Date.now() + 48 * 3600_000).toISOString();
    await fakeAppointments.repo.create({
      patientId: pat1._id,
      doctorId: doctor._id,
      appointmentTypeId: apptType._id,
      provider: 'CALENDLY',
      calendlyEventUri: 'https://api.calendly.com/scheduled_events/EV_CANCEL',
      calendlyInviteeUri: 'https://api.calendly.com/scheduled_events/EV_CANCEL/invitees/INV_CANCEL',
      startAt: new Date(slotIso),
      endAt: new Date(new Date(slotIso).getTime() + 900_000),
      status: 'CONFIRMED',
    });

    // pat_wait joins waitlist
    const joinRes = await request(app)
      .post('/api/v1/waitlist')
      .set(bearer('pat_wait'))
      .send({
        doctorId: String(doctor._id),
        appointmentTypeId: String(apptType._id),
        preferredDate: slotIso,
        timezone: 'Asia/Kolkata',
      });
    assert.equal(joinRes.status, 201);

    // Calendly returns the open slot when re-queried
    mock.method(calendlyClient, 'listEventTypeAvailableTimes', async () => ({
      collection: [{ start_time: slotIso, status: 'available' }],
    }));

    // Cancellation webhook arrives
    const cancelBody = JSON.stringify({
      event: 'invitee.canceled',
      created_at: '2026-12-01T12:00:00Z',
      payload: {
        uri: 'https://api.calendly.com/scheduled_events/EV_CANCEL/invitees/INV_CANCEL',
        event: 'https://api.calendly.com/scheduled_events/EV_CANCEL',
        rescheduled: false,
      },
    });
    const ts = Math.floor(Date.now() / 1000);
    const sig = crypto.createHmac('sha256', 'test-webhook-signing-key').update(`${ts}.${cancelBody}`, 'utf8').digest('hex');

    const whRes = await request(app)
      .post('/api/v1/webhooks/calendly')
      .set('Content-Type', 'application/json')
      .set('Calendly-Webhook-Signature', `t=${ts},v1=${sig}`)
      .send(cancelBody);
    assert.equal(whRes.status, 200);

    // Waitlist offer was created (not auto-booked!)
    assert.equal(fakeWaitlist.offers.size, 1);
    const offer = [...fakeWaitlist.offers.values()][0];
    assert.equal(offer.status, 'PENDING');

    // pat_wait accepts offer -> revalidates Calendly and books
    mock.method(calendlyClient, 'createInvitee', async () => ({
      resource: {
        uri: 'https://api.calendly.com/scheduled_events/EV_WAIT/invitees/INV_WAIT',
        event: 'https://api.calendly.com/scheduled_events/EV_WAIT',
      },
    }));

    const acceptRes = await request(app)
      .post(`/api/v1/waitlist/offers/${offer._id}/accept`)
      .set(bearer('pat_wait'));
    assert.equal(acceptRes.status, 201);
    assert.equal(acceptRes.body.data.appointment.status, 'CONFIRMED');

    // Re-accepting same offer is rejected
    const dupAccept = await request(app)
      .post(`/api/v1/waitlist/offers/${offer._id}/accept`)
      .set(bearer('pat_wait'));
    assert.equal(dupAccept.status, 409);
  });
});
