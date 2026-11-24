import crypto from 'node:crypto';
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
import {
  createFakeAppointmentRepository,
  createFakeCalendlyRepository,
  createFakeCalendlyWebhookRepository,
} from './helpers/fakePhase5Repositories.js';
import { createFakeNotificationRepository } from './helpers/fakePhase6Repositories.js';

const { default: app } = await import('../src/app.js');
const { userRepository } = await import('../src/modules/users/user.repository.js');
const { doctorApplicationRepository } = await import('../src/modules/doctorApplications/doctorApplication.repository.js');
const { nmcLookupRepository } = await import('../src/modules/doctorVerification/nmcLookup.repository.js');
const { doctorVerificationRepository } = await import('../src/modules/doctorVerification/verification.repository.js');
const { doctorRepository } = await import('../src/modules/doctors/doctor.repository.js');
const { clinicRepository } = await import('../src/modules/clinics/clinic.repository.js');
const { auditLogRepository } = await import('../src/modules/auditLogs/auditLog.repository.js');
const { calendlyRepository } = await import('../src/modules/calendly/calendly.repository.js');
const { appointmentRepository } = await import('../src/modules/appointments/appointment.repository.js');
const { calendlyWebhookRepository } = await import('../src/modules/webhooks/calendlyWebhook.repository.js');
const { notificationRepository } = await import('../src/modules/notifications/notification.repository.js');
const { clerkGateway } = await import('../src/integrations/clerk/clerk.gateway.js');
const { calendlyOAuth } = await import('../src/integrations/calendly/calendly.oauth.js');
const { calendlyClient, CalendlyProviderError } = await import('../src/integrations/calendly/calendly.client.js');

const bearer = (id) => ({ Authorization: `Bearer ${signSessionToken(id)}` });

let fakeUsers;
let fakeApps;
let fakeLookups;
let fakeVerifications;
let fakeDoctors;
let fakeClinics;
let fakeAudits;
let fakeCalendly;
let fakeAppointments;
let fakeWebhooks;
let fakeNotifications;

let origRepos;

const signCalendlyWebhook = (rawBody, signingKey, tsSec = Math.floor(Date.now() / 1000)) => {
  const sig = crypto.createHmac('sha256', signingKey).update(`${tsSec}.${rawBody}`, 'utf8').digest('hex');
  return `t=${tsSec},v1=${sig}`;
};

beforeEach(async () => {
  process.env.CALENDLY_CLIENT_ID = 'test-client-id';
  process.env.CALENDLY_CLIENT_SECRET = 'test-client-secret';
  process.env.CALENDLY_WEBHOOK_SIGNING_KEY = 'test-webhook-signing-key';

  fakeUsers = createFakeUserRepository();
  fakeApps = createFakeDoctorApplicationRepository();
  fakeLookups = createFakeNmcLookupRepository();
  fakeVerifications = createFakeDoctorVerificationRepository();
  fakeDoctors = createFakeDoctorRepository();
  fakeClinics = createFakeClinicRepository();
  fakeAudits = createFakeAuditLogRepository();
  fakeCalendly = createFakeCalendlyRepository();
  fakeAppointments = createFakeAppointmentRepository();
  fakeWebhooks = createFakeCalendlyWebhookRepository();
  fakeNotifications = createFakeNotificationRepository();

  origRepos = {
    user: { ...userRepository },
    app: { ...doctorApplicationRepository },
    lookup: { ...nmcLookupRepository },
    verif: { ...doctorVerificationRepository },
    doctor: { ...doctorRepository },
    clinic: { ...clinicRepository },
    audit: { ...auditLogRepository },
    calendly: { ...calendlyRepository },
    appt: { ...appointmentRepository },
    webhook: { ...calendlyWebhookRepository },
    notif: { ...notificationRepository },
  };

  Object.assign(userRepository, fakeUsers.repo);
  Object.assign(doctorApplicationRepository, fakeApps.repo);
  Object.assign(nmcLookupRepository, fakeLookups.repo);
  Object.assign(doctorVerificationRepository, fakeVerifications.repo);
  Object.assign(doctorRepository, fakeDoctors.repo);
  Object.assign(clinicRepository, fakeClinics.repo);
  Object.assign(auditLogRepository, fakeAudits.repo);
  Object.assign(calendlyRepository, fakeCalendly.repo);
  Object.assign(appointmentRepository, fakeAppointments.repo);
  Object.assign(calendlyWebhookRepository, fakeWebhooks.repo);
  Object.assign(notificationRepository, fakeNotifications.repo);

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
  Object.assign(doctorApplicationRepository, origRepos.app);
  Object.assign(nmcLookupRepository, origRepos.lookup);
  Object.assign(doctorVerificationRepository, origRepos.verif);
  Object.assign(doctorRepository, origRepos.doctor);
  Object.assign(clinicRepository, origRepos.clinic);
  Object.assign(auditLogRepository, origRepos.audit);
  Object.assign(calendlyRepository, origRepos.calendly);
  Object.assign(appointmentRepository, origRepos.appt);
  Object.assign(calendlyWebhookRepository, origRepos.webhook);
  Object.assign(notificationRepository, origRepos.notif);
  mock.restoreAll();
});

const seedApprovedDoctor = async (clerkId = 'doc_1', fee = 500, city = 'Ghaziabad', experience = 10) => {
  await request(app).post('/api/v1/users/onboard').set(bearer(clerkId)).send({ accountType: 'DOCTOR' });
  const user = fakeUsers.store.get(clerkId);
  user.onboardingStatus = 'APPROVED';

  const clinic = await fakeClinics.repo.create({
    clinicName: 'MediCare Clinic',
    clinicType: 'CLINIC',
    address: { city, state: 'Uttar Pradesh', country: 'India', pincode: '201001' },
    verificationStatus: 'VERIFIED',
  });

  const doctor = await fakeDoctors.repo.upsertFromApplication(
    {
      _id: crypto.randomUUID(),
      userId: user._id,
      personalDetails: { fullName: `Dr. ${clerkId}`, email: user.email },
      professionalDetails: { qualification: 'MBBS, MD', specialization: 'Cardiology', experience, medicalSystem: 'MODERN_MEDICINE' },
      medicalRegistration: { councilName: 'UPMC', registrationNumber: 'UP-12345', registrationYear: 2016, stateCode: 'UP' },
      clinicDetails: { clinicName: 'MediCare Clinic', clinicType: 'CLINIC', address: { city, state: 'Uttar Pradesh' } },
    },
    user._id,
    new Date(),
    { primaryClinicId: clinic._id, clinicIds: [clinic._id] }
  );

  await fakeDoctors.repo.updatePracticeProfile(user._id, {
    consultationFee: fee,
    consultationModes: ['IN_PERSON', 'VIDEO'],
    bio: 'Senior Cardiologist',
  });

  return { user, doctor, clinic };
};

const connectDoctorCalendly = async (clerkId = 'doc_1') => {
  mock.method(calendlyOAuth, 'exchangeCodeForTokens', async () => ({
    access_token: 'secret-access-token',
    refresh_token: 'secret-refresh-token',
    expires_in: 7200,
    scope: 'users:read event_types:read availability:read scheduled_events:read scheduled_events:write webhooks:write',
  }));
  mock.method(calendlyClient, 'getCurrentUser', async () => ({
    resource: {
      uri: 'https://api.calendly.com/users/USER_1',
      name: 'Dr. doc_1',
      email: 'doc_1@calendly.test',
      timezone: 'Asia/Kolkata',
      current_organization: 'https://api.calendly.com/organizations/ORG_1',
    },
  }));
  mock.method(calendlyClient, 'listEventTypes', async () => ({
    collection: [
      {
        uri: 'https://api.calendly.com/event_types/ET_15',
        name: 'General Consultation',
        description_plain: '15 min consult',
        duration: 15,
        kind: 'solo',
        active: true,
      },
    ],
  }));

  const connectRes = await request(app).get('/api/v1/integrations/calendly/connect').set(bearer(clerkId));
  assert.equal(connectRes.status, 200);
  const authUrl = new URL(connectRes.body.data.authorizationUrl);
  const state = authUrl.searchParams.get('state');
  assert.ok(state);
  assert.equal(authUrl.searchParams.get('code_challenge_method'), 'S256');

  const cbRes = await request(app).get(`/api/v1/integrations/calendly/callback?code=auth_code_1&state=${state}`);
  assert.equal(cbRes.status, 200);
  assert.equal(cbRes.body.data.connection.connected, true);
  // Ensure tokens are encrypted at rest and never exposed in response.
  assert.equal(cbRes.body.data.connection.accessTokenEncrypted, undefined);
  assert.equal(cbRes.body.data.connection.access_token, undefined);

  const selectRes = await request(app)
    .post('/api/v1/integrations/calendly/event-types/select')
    .set(bearer(clerkId))
    .send({
      calendlyEventTypeUri: 'https://api.calendly.com/event_types/ET_15',
      consultationFee: 500,
      consultationMode: 'VIDEO',
    });
  assert.equal(selectRes.status, 201);
  return selectRes.body.data.appointmentType;
};

describe('Phase 5: Doctor Management, Directory, Calendly, Appointments & Webhooks', () => {
  it('allows approved doctor to manage profile, blocks unapproved/suspended doctors, and filters public directory', async () => {
    // Pending doctor cannot access /doctors/me/profile
    await request(app).post('/api/v1/users/onboard').set(bearer('doc_pending')).send({ accountType: 'DOCTOR' });
    const pendingRes = await request(app).get('/api/v1/doctors/me/profile').set(bearer('doc_pending'));
    assert.equal(pendingRes.status, 403);

    const { doctor } = await seedApprovedDoctor('doc_1', 600, 'Ghaziabad', 12);

    const profRes = await request(app).get('/api/v1/doctors/me/profile').set(bearer('doc_1'));
    assert.equal(profRes.status, 200);
    assert.equal(profRes.body.data.doctor.consultationFee, 600);

    // Directory filters
    const dirRes = await request(app).get(
      '/api/v1/doctors?search=cardio&city=Ghaziabad&minFee=200&maxFee=1000&sortBy=experience'
    );
    assert.equal(dirRes.status, 200);
    assert.equal(dirRes.body.data.doctors.length, 1);
    assert.equal(dirRes.body.data.doctors[0].id, String(doctor._id));

    // Suspended doctor is excluded from public directory and management
    await fakeDoctors.repo.updateProfileStatus(doctor._id, { profileStatus: 'SUSPENDED' });
    const dirAfterSuspend = await request(app).get('/api/v1/doctors');
    assert.equal(dirAfterSuspend.body.data.doctors.length, 0);
    const mgmtAfterSuspend = await request(app).get('/api/v1/doctors/me/profile').set(bearer('doc_1'));
    assert.equal(mgmtAfterSuspend.status, 403);
  });

  it('rejects invalid OAuth state and supports Calendly OAuth + PKCE + availability (>31 day chunking)', async () => {
    const { doctor } = await seedApprovedDoctor('doc_1');
    const badCb = await request(app).get('/api/v1/integrations/calendly/callback?code=c1&state=invalid_state');
    assert.equal(badCb.status, 400);
    assert.equal(badCb.body.code, 'INVALID_OAUTH_STATE');

    const apptType = await connectDoctorCalendly('doc_1');

    // Verify encrypted token in store is not plaintext
    const storedConn = fakeCalendly.connections.get(String(doctor._id));
    assert.notEqual(storedConn.accessTokenEncrypted, 'secret-access-token');

    let apiCalls = 0;
    mock.method(calendlyClient, 'listEventTypeAvailableTimes', async () => {
      apiCalls += 1;
      return {
        collection: [{ start_time: '2026-12-10T04:30:00Z', status: 'available' }],
      };
    });

    // 40-day span -> splits into 2 Calendly API calls (31 + 9 days)
    const availRes = await request(app).get(
      `/api/v1/doctors/${doctor._id}/availability?appointmentTypeId=${apptType.id}&startDate=2026-12-01T00:00:00Z&endDate=2027-01-10T00:00:00Z&timezone=Asia/Kolkata`
    );
    assert.equal(availRes.status, 200);
    assert.equal(apiCalls, 2);
    assert.equal(availRes.body.data.timezone, 'Asia/Kolkata');
    assert.equal(availRes.body.data.availableSlots[0].displayTime, '10:00 AM');
  });

  it('books appointment idempotently, handles 409 slot-taken & timeout reconciliation, cancels, and reschedules', async () => {
    await request(app).post('/api/v1/users/onboard').set(bearer('pat_1')).send({ accountType: 'PATIENT' });
    await request(app).post('/api/v1/users/onboard').set(bearer('pat_2')).send({ accountType: 'PATIENT' });
    const { doctor } = await seedApprovedDoctor('doc_1');
    const apptType = await connectDoctorCalendly('doc_1');

    mock.method(calendlyClient, 'createInvitee', async () => ({
      resource: {
        uri: 'https://api.calendly.com/scheduled_events/EV_1/invitees/INV_1',
        event: 'https://api.calendly.com/scheduled_events/EV_1',
        cancel_url: 'https://calendly.com/cancellations/INV_1',
        reschedule_url: 'https://calendly.com/reschedulings/INV_1',
      },
    }));

    const bookBody = {
      doctorId: String(doctor._id),
      appointmentTypeId: apptType.id,
      startTime: '2026-12-10T04:30:00.000Z',
      timezone: 'Asia/Kolkata',
    };

    const book1 = await request(app)
      .post('/api/v1/appointments')
      .set({ ...bearer('pat_1'), 'Idempotency-Key': 'idem-key-0001' })
      .send(bookBody);
    assert.equal(book1.status, 201);
    assert.equal(book1.body.data.appointment.status, 'CONFIRMED');
    const apptId = book1.body.data.appointment.id;

    // Duplicate idempotency key returns existing appointment without creating a second one
    const book2 = await request(app)
      .post('/api/v1/appointments')
      .set({ ...bearer('pat_1'), 'Idempotency-Key': 'idem-key-0001' })
      .send(bookBody);
    assert.equal(book2.status, 200);
    assert.equal(book2.body.data.appointment.id, apptId);

    // Other patient cannot cancel pat_1's appointment
    const otherCancel = await request(app)
      .post(`/api/v1/appointments/${apptId}/cancel`)
      .set(bearer('pat_2'))
      .send({ reason: 'Not mine' });
    assert.equal(otherCancel.status, 403);

    // Reschedule returns URL without marking RESCHEDULED prematurely
    const resched = await request(app).post(`/api/v1/appointments/${apptId}/reschedule`).set(bearer('pat_1'));
    assert.equal(resched.status, 200);
    assert.equal(resched.body.data.rescheduleUrl, 'https://calendly.com/reschedulings/INV_1');
    assert.equal(resched.body.data.status, 'CONFIRMED');

    // Cancel appointment
    mock.method(calendlyClient, 'cancelScheduledEvent', async () => ({ resource: { canceled_by: 'pat_1' } }));
    const cancelRes = await request(app)
      .post(`/api/v1/appointments/${apptId}/cancel`)
      .set(bearer('pat_1'))
      .send({ reason: 'Unable to attend' });
    assert.equal(cancelRes.status, 200);
    assert.equal(cancelRes.body.data.appointment.status, 'CANCELLED');

    // Repeated cancel is rejected
    const repeatCancel = await request(app)
      .post(`/api/v1/appointments/${apptId}/cancel`)
      .set(bearer('pat_1'))
      .send({ reason: 'Again' });
    assert.equal(repeatCancel.status, 409);

    // Provider 409 slot taken
    mock.method(calendlyClient, 'createInvitee', async () => {
      throw new CalendlyProviderError('Slot taken', { statusCode: 409, code: 'SLOT_UNAVAILABLE' });
    });
    const conflictRes = await request(app)
      .post('/api/v1/appointments')
      .set({ ...bearer('pat_2'), 'Idempotency-Key': 'idem-key-0002' })
      .send(bookBody);
    assert.equal(conflictRes.status, 409);
    assert.equal(conflictRes.body.code, 'SLOT_UNAVAILABLE');

    // Provider timeout -> REQUIRES_RECONCILIATION
    mock.method(calendlyClient, 'createInvitee', async () => {
      throw new CalendlyProviderError('Timeout', { statusCode: 504, code: 'CALENDLY_TIMEOUT', isTimeout: true });
    });
    const timeoutRes = await request(app)
      .post('/api/v1/appointments')
      .set({ ...bearer('pat_2'), 'Idempotency-Key': 'idem-key-0003' })
      .send(bookBody);
    assert.equal(timeoutRes.status, 504);
    assert.equal(timeoutRes.body.code, 'BOOKING_RECONCILIATION_REQUIRED');
  });

  it('verifies Calendly webhook signatures, deduplicates events, and links reschedule webhooks', async () => {
    await request(app).post('/api/v1/users/onboard').set(bearer('pat_1')).send({ accountType: 'PATIENT' });
    const { doctor } = await seedApprovedDoctor('doc_1');
    const apptType = await connectDoctorCalendly('doc_1');

    const oldAppt = await fakeAppointments.repo.create({
      patientId: fakeUsers.store.get('pat_1')._id,
      doctorId: doctor._id,
      appointmentTypeId: apptType.id,
      provider: 'CALENDLY',
      calendlyEventUri: 'https://api.calendly.com/scheduled_events/EV_OLD',
      calendlyInviteeUri: 'https://api.calendly.com/scheduled_events/EV_OLD/invitees/INV_OLD',
      startAt: new Date('2026-12-10T04:30:00Z'),
      endAt: new Date('2026-12-10T04:45:00Z'),
      timezone: 'Asia/Kolkata',
      status: 'CONFIRMED',
    });

    // Reject invalid signature
    const badSig = await request(app)
      .post('/api/v1/webhooks/calendly')
      .set('Content-Type', 'application/json')
      .set('Calendly-Webhook-Signature', 't=123,v1=deadbeef')
      .send(JSON.stringify({ event: 'invitee.canceled', payload: {} }));
    assert.equal(badSig.status, 400);

    // Reschedule: invitee.canceled with rescheduled=true -> RESCHEDULED (not CANCELLED)
    const cancelPayload = JSON.stringify({
      event: 'invitee.canceled',
      created_at: '2026-12-01T10:00:00Z',
      payload: {
        uri: 'https://api.calendly.com/scheduled_events/EV_OLD/invitees/INV_OLD',
        event: 'https://api.calendly.com/scheduled_events/EV_OLD',
        rescheduled: true,
        new_invitee: 'https://api.calendly.com/scheduled_events/EV_NEW/invitees/INV_NEW',
      },
    });
    const cancelSig = signCalendlyWebhook(cancelPayload, 'test-webhook-signing-key');
    const wh1 = await request(app)
      .post('/api/v1/webhooks/calendly')
      .set('Content-Type', 'application/json')
      .set('Calendly-Webhook-Signature', cancelSig)
      .send(cancelPayload);
    assert.equal(wh1.status, 200);
    assert.equal((await fakeAppointments.repo.findById(oldAppt._id)).status, 'RESCHEDULED');

    // Reschedule: invitee.created with old_invitee -> creates new linked CONFIRMED appointment
    const createdPayload = JSON.stringify({
      event: 'invitee.created',
      created_at: '2026-12-01T10:00:01Z',
      payload: {
        uri: 'https://api.calendly.com/scheduled_events/EV_NEW/invitees/INV_NEW',
        event: 'https://api.calendly.com/scheduled_events/EV_NEW',
        old_invitee: 'https://api.calendly.com/scheduled_events/EV_OLD/invitees/INV_OLD',
        timezone: 'Asia/Kolkata',
        scheduled_event: {
          start_time: '2026-12-11T05:00:00Z',
          end_time: '2026-12-11T05:15:00Z',
        },
      },
    });
    const createdSig = signCalendlyWebhook(createdPayload, 'test-webhook-signing-key');
    const wh2 = await request(app)
      .post('/api/v1/webhooks/calendly')
      .set('Content-Type', 'application/json')
      .set('Calendly-Webhook-Signature', createdSig)
      .send(createdPayload);
    assert.equal(wh2.status, 200);

    const newAppt = await fakeAppointments.repo.findByInviteeUri(
      'https://api.calendly.com/scheduled_events/EV_NEW/invitees/INV_NEW'
    );
    assert.ok(newAppt);
    assert.equal(newAppt.status, 'CONFIRMED');
    assert.equal(String(newAppt.rescheduledFromId), String(oldAppt._id));

    // Duplicate webhook is ignored idempotently
    const whDup = await request(app)
      .post('/api/v1/webhooks/calendly')
      .set('Content-Type', 'application/json')
      .set('Calendly-Webhook-Signature', createdSig)
      .send(createdPayload);
    assert.equal(whDup.status, 200);
    assert.equal(whDup.body.data.duplicate, true);
  });
});
