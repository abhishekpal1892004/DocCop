import { signSessionToken } from './setup.js';
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createFakeUserRepository } from './helpers/fakeUserRepository.js';
import { createFakeDoctorRepository } from './helpers/fakeDoctorRepositories.js';
import {
  createFakeAppointmentRepository,
  createFakeCalendlyRepository,
} from './helpers/fakePhase5Repositories.js';
import { createFakeNotificationRepository } from './helpers/fakePhase6Repositories.js';
import { createFakeFollowUpRepository } from './helpers/fakePhase10Repositories.js';

const { default: app } = await import('../src/app.js');
const { userRepository } = await import('../src/modules/users/user.repository.js');
const { doctorRepository } = await import('../src/modules/doctors/doctor.repository.js');
const { calendlyRepository } = await import('../src/modules/calendly/calendly.repository.js');
const { appointmentRepository } = await import('../src/modules/appointments/appointment.repository.js');
const { notificationRepository } = await import('../src/modules/notifications/notification.repository.js');
const { followUpRepository } = await import('../src/modules/followUps/followUp.repository.js');
const { clerkGateway } = await import('../src/integrations/clerk/clerk.gateway.js');
const { calendlyClient } = await import('../src/integrations/calendly/calendly.client.js');
const { calendlyTokenService } = await import('../src/integrations/calendly/calendly.token.service.js');

const bearer = (id) => ({ Authorization: `Bearer ${signSessionToken(id)}` });

let fakeUsers;
let fakeDoctors;
let fakeCalendly;
let fakeAppointments;
let fakeNotifications;
let fakeFollowUps;
let origRepos;

beforeEach(async () => {
  fakeUsers = createFakeUserRepository();
  fakeDoctors = createFakeDoctorRepository();
  fakeCalendly = createFakeCalendlyRepository();
  fakeAppointments = createFakeAppointmentRepository();
  fakeNotifications = createFakeNotificationRepository();
  fakeFollowUps = createFakeFollowUpRepository();

  origRepos = {
    user: { ...userRepository },
    doctor: { ...doctorRepository },
    calendly: { ...calendlyRepository },
    appt: { ...appointmentRepository },
    notif: { ...notificationRepository },
    followUp: { ...followUpRepository },
  };

  Object.assign(userRepository, fakeUsers.repo);
  Object.assign(doctorRepository, fakeDoctors.repo);
  Object.assign(calendlyRepository, fakeCalendly.repo);
  Object.assign(appointmentRepository, fakeAppointments.repo);
  Object.assign(notificationRepository, fakeNotifications.repo);
  Object.assign(followUpRepository, fakeFollowUps.repo);

  mock.method(clerkGateway, 'getUser', async (clerkUserId) => ({
    id: clerkUserId,
    emailAddresses: [{ emailAddress: `${clerkUserId}@test.local` }],
    firstName: 'Test',
    lastName: 'User',
  }));
});

afterEach(() => {
  Object.assign(userRepository, origRepos.user);
  Object.assign(doctorRepository, origRepos.doctor);
  Object.assign(calendlyRepository, origRepos.calendly);
  Object.assign(appointmentRepository, origRepos.appt);
  Object.assign(notificationRepository, origRepos.notif);
  Object.assign(followUpRepository, origRepos.followUp);
  mock.restoreAll();
});

const seedDoctorPatientAndAppointment = async () => {
  const docUser = await fakeUsers.repo.create({
    clerkUserId: 'clerk_fu_doc',
    email: 'fudoc@test.local',
    firstName: 'Dr',
    lastName: 'FollowUp',
    role: 'DOCTOR',
    accountStatus: 'ACTIVE',
    onboardingStatus: 'COMPLETED',
  });
  const otherDocUser = await fakeUsers.repo.create({
    clerkUserId: 'clerk_fu_doc2',
    email: 'fudoc2@test.local',
    firstName: 'Dr',
    lastName: 'Other',
    role: 'DOCTOR',
    accountStatus: 'ACTIVE',
    onboardingStatus: 'COMPLETED',
  });
  const patientUser = await fakeUsers.repo.create({
    clerkUserId: 'clerk_fu_pat',
    email: 'fupat@test.local',
    firstName: 'Pat',
    lastName: 'One',
    role: 'PATIENT',
    accountStatus: 'ACTIVE',
    onboardingStatus: 'COMPLETED',
  });

  const doctor = await fakeDoctors.repo.upsertFromApplication(
    {
      _id: 'app-fu-1',
      userId: docUser._id,
      personalDetails: { fullName: 'Dr FollowUp', email: docUser.email },
      professionalDetails: { qualification: 'MBBS, MD', specialization: 'Cardiology', experience: 10, medicalSystem: 'MODERN_MEDICINE' },
      medicalRegistration: { councilName: 'NMC', registrationNumber: 'NMC-FU-1', registrationYear: 2016, stateCode: 'DEL' },
      clinicDetails: { clinicName: 'FollowUp Clinic', clinicType: 'CLINIC', address: { city: 'Delhi' } },
    },
    docUser._id,
    new Date(),
    {}
  );
  await fakeDoctors.repo.upsertFromApplication(
    {
      _id: 'app-fu-2',
      userId: otherDocUser._id,
      personalDetails: { fullName: 'Dr Other', email: otherDocUser.email },
      professionalDetails: { qualification: 'MBBS', specialization: 'Cardiology', experience: 5, medicalSystem: 'MODERN_MEDICINE' },
      medicalRegistration: { councilName: 'NMC', registrationNumber: 'NMC-FU-2', registrationYear: 2019, stateCode: 'DEL' },
      clinicDetails: { clinicName: 'Other Clinic', clinicType: 'CLINIC', address: { city: 'Delhi' } },
    },
    otherDocUser._id,
    new Date(),
    {}
  );

  await fakeCalendly.repo.upsertConnection(doctor._id, {
    doctorId: doctor._id,
    doctorUserId: docUser._id,
    calendlyUserUri: 'https://api.calendly.com/users/doc-fu',
    accessTokenEncrypted: calendlyTokenService.encrypt('tok'),
    connectionStatus: 'CONNECTED',
  });
  const apptType = await fakeCalendly.repo.upsertAppointmentType(
    doctor._id,
    'https://api.calendly.com/event_types/fu-1',
    {
      doctorId: doctor._id,
      calendlyEventTypeUri: 'https://api.calendly.com/event_types/fu-1',
      name: 'Follow-Up Review',
      durationMinutes: 15,
      consultationMode: 'IN_PERSON',
      consultationFee: 300,
      isActive: true,
    }
  );

  const baseAppt = await fakeAppointments.repo.create({
    patientId: patientUser._id,
    doctorId: doctor._id,
    appointmentTypeId: apptType._id,
    scheduledStart: new Date(Date.now() - 86400_000),
    scheduledEnd: new Date(Date.now() - 86400_000 + 900_000),
    timezone: 'UTC',
    status: 'COMPLETED',
    consultationMode: 'IN_PERSON',
    feeSnapshot: 600,
  });

  return { docUser, otherDocUser, patientUser, doctor, apptType, baseAppt };
};

describe('Stage 10D - Follow-up & Patient Engagement', () => {
  it('creates follow-up by treating doctor, blocks unrelated doctor, lists for patient/doctor, and books once', async () => {
    const { docUser, otherDocUser, patientUser, apptType, baseAppt } = await seedDoctorPatientAndAppointment();

    // Unrelated doctor cannot create follow-up for another doctor's appointment
    const forbiddenRes = await request(app)
      .post('/api/v1/follow-ups')
      .set(bearer(otherDocUser.clerkUserId))
      .send({
        appointmentId: String(baseAppt._id),
        recommendedDate: new Date(Date.now() + 7 * 86400_000).toISOString(),
        reason: 'BP check',
        followUpType: 'ROUTINE',
      });
    assert.equal(forbiddenRes.status, 403);

    // Treating doctor creates follow-up
    const createRes = await request(app)
      .post('/api/v1/follow-ups')
      .set(bearer(docUser.clerkUserId))
      .send({
        appointmentId: String(baseAppt._id),
        recommendedDate: new Date(Date.now() + 7 * 86400_000).toISOString(),
        reason: 'Review blood pressure medication',
        followUpType: 'POST_CONSULTATION',
      });
    assert.equal(createRes.status, 201);
    const followUpId = createRes.body.data.followUp.id;
    assert.equal(createRes.body.data.followUp.status, 'PENDING');
    assert.equal(createRes.body.data.followUp.followUpType, 'POST_CONSULTATION');

    // Patient lists follow-ups
    const patListRes = await request(app)
      .get('/api/v1/follow-ups/my')
      .set(bearer(patientUser.clerkUserId));
    assert.equal(patListRes.status, 200);
    assert.equal(patListRes.body.data.followUps.length, 1);

    // Doctor lists follow-ups via /doctor/follow-ups
    const docListRes = await request(app)
      .get('/api/v1/doctor/follow-ups')
      .set(bearer(docUser.clerkUserId));
    assert.equal(docListRes.status, 200);
    assert.equal(docListRes.body.data.followUps.length, 1);

    // Mock Calendly booking for follow-up booking
    const slotStart = new Date(Date.now() + 7 * 86400_000).toISOString();
    mock.method(calendlyClient, 'listEventTypeAvailableTimes', async () => ({
      collection: [{ start_time: slotStart, status: 'available', scheduling_url: 'https://calendly.com/fu' }],
    }));
    mock.method(calendlyClient, 'createInvitee', async () => ({
      resource: {
        uri: 'https://api.calendly.com/scheduled_events/evt-fu/invitees/inv-fu',
        event: 'https://api.calendly.com/scheduled_events/evt-fu',
        cancel_url: 'https://calendly.com/cancellations/fu',
        reschedule_url: 'https://calendly.com/reschedules/fu',
      },
    }));

    const bookRes = await request(app)
      .post(`/api/v1/follow-ups/${followUpId}/book`)
      .set(bearer(patientUser.clerkUserId))
      .send({
        appointmentTypeId: String(apptType._id),
        startTime: slotStart,
        timezone: 'UTC',
      });
    assert.equal(bookRes.status, 201);
    assert.equal(bookRes.body.data.followUp.status, 'SCHEDULED');
    assert.ok(bookRes.body.data.followUp.bookedAppointmentId);
    assert.ok(bookRes.body.data.appointment.id);

    // Duplicate booking prevented
    const dupRes = await request(app)
      .post(`/api/v1/follow-ups/${followUpId}/book`)
      .set(bearer(patientUser.clerkUserId))
      .send({
        appointmentTypeId: String(apptType._id),
        startTime: slotStart,
        timezone: 'UTC',
      });
    assert.equal(dupRes.status, 409);
  });
});
