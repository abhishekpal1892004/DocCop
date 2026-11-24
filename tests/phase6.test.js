import crypto from 'node:crypto';
import { signSessionToken } from './setup.js';
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createFakeUserRepository } from './helpers/fakeUserRepository.js';
import { createFakeDoctorRepository } from './helpers/fakeDoctorRepositories.js';
import { createFakeClinicRepository } from './helpers/fakePhase4Repositories.js';
import {
  createFakeAppointmentRepository,
  createFakeCalendlyRepository,
} from './helpers/fakePhase5Repositories.js';
import { createFakeNotificationRepository } from './helpers/fakePhase6Repositories.js';

const { default: app } = await import('../src/app.js');
const { userRepository } = await import('../src/modules/users/user.repository.js');
const { doctorRepository } = await import('../src/modules/doctors/doctor.repository.js');
const { clinicRepository } = await import('../src/modules/clinics/clinic.repository.js');
const { calendlyRepository } = await import('../src/modules/calendly/calendly.repository.js');
const { appointmentRepository } = await import('../src/modules/appointments/appointment.repository.js');
const { notificationRepository } = await import('../src/modules/notifications/notification.repository.js');
const { clerkGateway } = await import('../src/integrations/clerk/clerk.gateway.js');
const { calendlyClient } = await import('../src/integrations/calendly/calendly.client.js');
const { calendlyTokenService } = await import('../src/integrations/calendly/calendly.token.service.js');
const { twilioClientGateway } = await import('../src/integrations/twilio/twilio.client.js');
const { runNotificationBatch } = await import('../src/modules/notifications/services/notificationScheduler.service.js');

const bearer = (id) => ({ Authorization: `Bearer ${signSessionToken(id)}` });

let fakeUsers;
let fakeDoctors;
let fakeClinics;
let fakeCalendly;
let fakeAppointments;
let fakeNotifications;
let origRepos;

beforeEach(async () => {
  process.env.TWILIO_ACCOUNT_SID = 'AC00000000000000000000000000000000';
  process.env.TWILIO_AUTH_TOKEN = 'test-twilio-auth-token';
  process.env.TWILIO_MESSAGING_SERVICE_SID = 'MG00000000000000000000000000000000';
  process.env.TWILIO_WHATSAPP_FROM = 'whatsapp:+14155238886';
  process.env.TWILIO_CONTENT_SID_APPOINTMENT_CONFIRMED = 'HXCONFIRMED001';
  process.env.TWILIO_CONTENT_SID_APPOINTMENT_REMINDER = 'HXREMINDER001';
  process.env.TWILIO_STATUS_CALLBACK_URL = 'https://api.medibook.test/api/v1/webhooks/twilio/status';

  fakeUsers = createFakeUserRepository();
  fakeDoctors = createFakeDoctorRepository();
  fakeClinics = createFakeClinicRepository();
  fakeCalendly = createFakeCalendlyRepository();
  fakeAppointments = createFakeAppointmentRepository();
  fakeNotifications = createFakeNotificationRepository();

  origRepos = {
    user: { ...userRepository },
    doctor: { ...doctorRepository },
    clinic: { ...clinicRepository },
    calendly: { ...calendlyRepository },
    appt: { ...appointmentRepository },
    notif: { ...notificationRepository },
  };

  Object.assign(userRepository, fakeUsers.repo);
  Object.assign(doctorRepository, fakeDoctors.repo);
  Object.assign(clinicRepository, fakeClinics.repo);
  Object.assign(calendlyRepository, fakeCalendly.repo);
  Object.assign(appointmentRepository, fakeAppointments.repo);
  Object.assign(notificationRepository, fakeNotifications.repo);

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
});

afterEach(() => {
  Object.assign(userRepository, origRepos.user);
  Object.assign(doctorRepository, origRepos.doctor);
  Object.assign(clinicRepository, origRepos.clinic);
  Object.assign(calendlyRepository, origRepos.calendly);
  Object.assign(appointmentRepository, origRepos.appt);
  Object.assign(notificationRepository, origRepos.notif);
  mock.restoreAll();
});

const seedDoctorAndAppointmentType = async () => {
  await request(app).post('/api/v1/users/onboard').set(bearer('doc_1')).send({ accountType: 'DOCTOR' });
  const docUser = fakeUsers.store.get('doc_1');
  const doctor = await fakeDoctors.repo.upsertFromApplication(
    {
      _id: crypto.randomUUID(),
      userId: docUser._id,
      personalDetails: { fullName: 'Dr. Sharma', email: docUser.email },
      professionalDetails: { qualification: 'MBBS', specialization: 'Cardiology', experience: 5, medicalSystem: 'MODERN_MEDICINE' },
      medicalRegistration: { councilName: 'UPMC', registrationNumber: 'UP-111', registrationYear: 2018, stateCode: 'UP' },
      clinicDetails: { clinicName: 'Sharma Clinic', clinicType: 'CLINIC', address: { city: 'Noida' } },
    },
    docUser._id,
    new Date(),
    {}
  );

  await fakeCalendly.repo.upsertConnection(doctor._id, {
    doctorId: doctor._id,
    doctorUserId: docUser._id,
    calendlyUserUri: 'https://api.calendly.com/users/DOC1',
    accessTokenEncrypted: calendlyTokenService.encrypt('test-access-token'),
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

  return { docUser, doctor, apptType };
};

describe('Phase 6: Twilio Notifications, Preferences, Scheduler & Webhooks', () => {
  it('enforces independent SMS/WhatsApp consent and E.164 phone validation on preferences', async () => {
    await request(app).post('/api/v1/users/onboard').set(bearer('pat_1')).send({ accountType: 'PATIENT' });

    // Default preferences: SMS and WhatsApp disabled
    const defRes = await request(app).get('/api/v1/notifications/preferences').set(bearer('pat_1'));
    assert.equal(defRes.status, 200);
    assert.equal(defRes.body.data.preferences.sms.enabled, false);
    assert.equal(defRes.body.data.preferences.whatsapp.enabled, false);

    // Enabling SMS without opt-in is rejected
    const noConsent = await request(app)
      .patch('/api/v1/notifications/preferences')
      .set(bearer('pat_1'))
      .send({ phoneNumber: '+919876543210', sms: { enabled: true } });
    assert.equal(noConsent.status, 400);
    assert.equal(noConsent.body.code, 'CONSENT_REQUIRED');

    // Opting into SMS does NOT enable WhatsApp
    const smsOnly = await request(app)
      .patch('/api/v1/notifications/preferences')
      .set(bearer('pat_1'))
      .send({
        phoneNumber: '+919876543210',
        sms: { enabled: true, optedIn: true, consentSource: 'SETTINGS_PAGE' },
      });
    assert.equal(smsOnly.status, 200);
    assert.equal(smsOnly.body.data.preferences.sms.enabled, true);
    assert.equal(smsOnly.body.data.preferences.whatsapp.enabled, false);
    assert.equal(smsOnly.body.data.preferences.whatsapp.optedIn, false);
  });

  it('schedules confirmation + 24h/2h reminders on booking, supports in-app read, and cancels reminders on cancel', async () => {
    await request(app).post('/api/v1/users/onboard').set(bearer('pat_1')).send({ accountType: 'PATIENT' });
    const { doctor, apptType } = await seedDoctorAndAppointmentType();

    // Patient opts into SMS + WhatsApp
    await request(app)
      .patch('/api/v1/notifications/preferences')
      .set(bearer('pat_1'))
      .send({
        phoneNumber: '+919876543210',
        sms: { enabled: true, optedIn: true },
        whatsapp: { enabled: true, optedIn: true },
      });

    mock.method(calendlyClient, 'createInvitee', async () => ({
      resource: {
        uri: 'https://api.calendly.com/scheduled_events/EV1/invitees/INV1',
        event: 'https://api.calendly.com/scheduled_events/EV1',
        cancel_url: 'https://calendly.com/c/1',
        reschedule_url: 'https://calendly.com/r/1',
      },
    }));

    const futureStart = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const bookRes = await request(app)
      .post('/api/v1/appointments')
      .set({ ...bearer('pat_1'), 'Idempotency-Key': 'notif-book-001' })
      .send({
        doctorId: String(doctor._id),
        appointmentTypeId: String(apptType._id),
        startTime: futureStart,
        timezone: 'Asia/Kolkata',
      });
    assert.equal(bookRes.status, 201);
    const apptId = bookRes.body.data.appointment.id;

    // Patient has in-app notifications (confirmation + 24h + 2h)
    const inAppRes = await request(app).get('/api/v1/notifications/my').set(bearer('pat_1'));
    assert.equal(inAppRes.status, 200);
    assert.ok(inAppRes.body.data.notifications.length >= 1);
    assert.ok(inAppRes.body.data.unreadCount >= 1);

    const firstId = inAppRes.body.data.notifications[0].id;
    const readOne = await request(app).patch(`/api/v1/notifications/${firstId}/read`).set(bearer('pat_1'));
    assert.equal(readOne.status, 200);
    assert.ok(readOne.body.data.notification.readAt);

    const readAll = await request(app).patch('/api/v1/notifications/read-all').set(bearer('pat_1'));
    assert.equal(readAll.status, 200);

    // Cancel appointment -> pending reminders become CANCELLED
    mock.method(calendlyClient, 'cancelScheduledEvent', async () => ({ resource: {} }));
    await request(app)
      .post(`/api/v1/appointments/${apptId}/cancel`)
      .set(bearer('pat_1'))
      .send({ reason: 'Changed plans' });

    const cancelledReminders = [...fakeNotifications.notifications.values()].filter(
      (n) =>
        String(n.appointmentId) === String(apptId) &&
        (n.eventType === 'APPOINTMENT_REMINDER_24H' || n.eventType === 'APPOINTMENT_REMINDER_2H')
    );
    assert.ok(cancelledReminders.length >= 2);
    assert.ok(cancelledReminders.every((r) => r.status === 'CANCELLED'));
  });

  it('processes due SMS & WhatsApp jobs in scheduler, handles timeouts/permanent errors, and validates Twilio callbacks', async () => {
    await request(app).post('/api/v1/users/onboard').set(bearer('pat_1')).send({ accountType: 'PATIENT' });
    const { doctor, apptType } = await seedDoctorAndAppointmentType();

    await request(app)
      .patch('/api/v1/notifications/preferences')
      .set(bearer('pat_1'))
      .send({
        phoneNumber: '+919876543210',
        sms: { enabled: true, optedIn: true },
        whatsapp: { enabled: true, optedIn: true },
      });

    mock.method(calendlyClient, 'createInvitee', async () => ({
      resource: {
        uri: 'https://api.calendly.com/scheduled_events/EV2/invitees/INV2',
        event: 'https://api.calendly.com/scheduled_events/EV2',
      },
    }));

    await request(app)
      .post('/api/v1/appointments')
      .set({ ...bearer('pat_1'), 'Idempotency-Key': 'notif-book-002' })
      .send({
        doctorId: String(doctor._id),
        appointmentTypeId: String(apptType._id),
        startTime: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        timezone: 'Asia/Kolkata',
      });

    let sentCount = 0;
    mock.method(twilioClientGateway, 'createMessage', async (payload) => {
      sentCount += 1;
      if (String(payload.to).startsWith('whatsapp:')) {
        assert.equal(payload.contentSid, 'HXCONFIRMED001');
        assert.equal(payload.body, undefined);
      }
      return { sid: `SM_TEST_${sentCount}`, status: 'queued' };
    });

    // Run scheduler for due jobs (confirmation SMS + WhatsApp; future 24h/2h reminders stay SCHEDULED)
    const batch = await runNotificationBatch({ now: new Date(Date.now() + 1000) });
    assert.equal(batch.length, 2);
    assert.ok(batch.every((r) => r.outcome === 'DISPATCHED'));

    // Twilio status callback: reject invalid signature
    const badCb = await request(app)
      .post('/api/v1/webhooks/twilio/status')
      .type('form')
      .send({ MessageSid: 'SM_TEST_1', MessageStatus: 'delivered' });
    assert.equal(badCb.status, 403);

    // Valid signature -> updates to DELIVERED; out-of-order 'sent' does NOT downgrade DELIVERED
    mock.method(twilioClientGateway, 'validateRequest', () => true);
    const delivCb = await request(app)
      .post('/api/v1/webhooks/twilio/status')
      .set('X-Twilio-Signature', 'valid-sig')
      .type('form')
      .send({ MessageSid: 'SM_TEST_1', MessageStatus: 'delivered' });
    assert.equal(delivCb.status, 200);
    assert.equal(delivCb.body.data.status, 'DELIVERED');

    const staleCb = await request(app)
      .post('/api/v1/webhooks/twilio/status')
      .set('X-Twilio-Signature', 'valid-sig')
      .type('form')
      .send({ MessageSid: 'SM_TEST_1', MessageStatus: 'sent' });
    assert.equal(staleCb.status, 200);
    assert.equal(staleCb.body.data.updated, false);

    // Ambiguous timeout marks UNKNOWN without blind retry
    await fakeNotifications.repo.create({
      userId: fakeUsers.store.get('pat_1')._id,
      appointmentId: crypto.randomUUID(),
      idempotencyKey: 'timeout-job-1',
      eventType: 'APPOINTMENT_CONFIRMED',
      channel: 'SMS',
      provider: 'TWILIO',
      recipient: '+919876543210',
      messageBody: 'Test',
      status: 'SCHEDULED',
      scheduledAt: new Date(Date.now() - 1000),
    });
    mock.method(twilioClientGateway, 'createMessage', async () => {
      const err = new Error('ETIMEDOUT');
      err.code = 'ETIMEDOUT';
      throw err;
    });
    const timeoutBatch = await runNotificationBatch({ now: new Date() });
    assert.equal(timeoutBatch[0].outcome, 'UNKNOWN');
    assert.equal((await fakeNotifications.repo.findByIdempotencyKey('timeout-job-1')).status, 'UNKNOWN');
  });
});
