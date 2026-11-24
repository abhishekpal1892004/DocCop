import crypto from 'node:crypto';
import { signSessionToken } from './setup.js';
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createFakeUserRepository } from './helpers/fakeUserRepository.js';
import { createFakeDoctorRepository } from './helpers/fakeDoctorRepositories.js';
import { createFakeClinicRepository } from './helpers/fakePhase4Repositories.js';
import { createFakeAppointmentRepository, createFakeCalendlyRepository } from './helpers/fakePhase5Repositories.js';
import { createFakeNotificationRepository } from './helpers/fakePhase6Repositories.js';
import { createFakePaymentRepository } from './helpers/fakePhase8Repositories.js';

const { default: app } = await import('../src/app.js');
const { userRepository } = await import('../src/modules/users/user.repository.js');
const { doctorRepository } = await import('../src/modules/doctors/doctor.repository.js');
const { clinicRepository } = await import('../src/modules/clinics/clinic.repository.js');
const { calendlyRepository } = await import('../src/modules/calendly/calendly.repository.js');
const { appointmentRepository } = await import('../src/modules/appointments/appointment.repository.js');
const { notificationRepository } = await import('../src/modules/notifications/notification.repository.js');
const { paymentRepository } = await import('../src/modules/payments/payment.repository.js');
const { clerkGateway } = await import('../src/integrations/clerk/clerk.gateway.js');
const { calendlyClient } = await import('../src/integrations/calendly/calendly.client.js');
const { calendlyTokenService } = await import('../src/integrations/calendly/calendly.token.service.js');
const { razorpayClientGateway } = await import('../src/integrations/razorpay/razorpay.client.js');

const bearer = (id) => ({ Authorization: `Bearer ${signSessionToken(id)}` });

let fakeUsers;
let fakeDoctors;
let fakeClinics;
let fakeCalendly;
let fakeAppointments;
let fakeNotifications;
let fakePayments;
let origRepos;

beforeEach(async () => {
  process.env.RAZORPAY_KEY_ID = 'rzp_test_key';
  process.env.RAZORPAY_KEY_SECRET = 'rzp_test_secret';
  process.env.RAZORPAY_WEBHOOK_SECRET = 'rzp_webhook_secret';

  fakeUsers = createFakeUserRepository();
  fakeDoctors = createFakeDoctorRepository();
  fakeClinics = createFakeClinicRepository();
  fakeCalendly = createFakeCalendlyRepository();
  fakeAppointments = createFakeAppointmentRepository();
  fakeNotifications = createFakeNotificationRepository();
  fakePayments = createFakePaymentRepository();

  origRepos = {
    user: { ...userRepository },
    doctor: { ...doctorRepository },
    clinic: { ...clinicRepository },
    calendly: { ...calendlyRepository },
    appt: { ...appointmentRepository },
    notif: { ...notificationRepository },
    pay: { ...paymentRepository },
  };

  Object.assign(userRepository, fakeUsers.repo);
  Object.assign(doctorRepository, fakeDoctors.repo);
  Object.assign(clinicRepository, fakeClinics.repo);
  Object.assign(calendlyRepository, fakeCalendly.repo);
  Object.assign(appointmentRepository, fakeAppointments.repo);
  Object.assign(notificationRepository, fakeNotifications.repo);
  Object.assign(paymentRepository, fakePayments.repo);

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
  Object.assign(clinicRepository, origRepos.clinic);
  Object.assign(calendlyRepository, origRepos.calendly);
  Object.assign(appointmentRepository, origRepos.appt);
  Object.assign(notificationRepository, origRepos.notif);
  Object.assign(paymentRepository, origRepos.pay);
  mock.restoreAll();
});

const seedDoctorAndBookPaid = async (fee = 500) => {
  await request(app).post('/api/v1/users/onboard').set(bearer('pat_1')).send({ accountType: 'PATIENT' });
  await request(app).post('/api/v1/users/onboard').set(bearer('doc_1')).send({ accountType: 'DOCTOR' });
  const docUser = fakeUsers.store.get('doc_1');

  const doctor = await fakeDoctors.repo.upsertFromApplication(
    {
      _id: crypto.randomUUID(),
      userId: docUser._id,
      personalDetails: { fullName: 'Dr. Rao', email: docUser.email },
      professionalDetails: { qualification: 'MBBS', specialization: 'Cardiology', experience: 7, medicalSystem: 'MODERN_MEDICINE' },
      medicalRegistration: { councilName: 'UPMC', registrationNumber: 'UP-500', registrationYear: 2018, stateCode: 'UP' },
      clinicDetails: { clinicName: 'Rao Clinic', clinicType: 'CLINIC', address: { city: 'Noida' } },
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
    name: 'Video Consult',
    durationMinutes: 15,
    consultationFee: fee,
    consultationMode: 'VIDEO',
    isActive: true,
  });

  mock.method(calendlyClient, 'createInvitee', async () => ({
    resource: {
      uri: `https://api.calendly.com/scheduled_events/EV_${Date.now()}/invitees/INV_1`,
      event: `https://api.calendly.com/scheduled_events/EV_${Date.now()}`,
    },
  }));

  const bookRes = await request(app)
    .post('/api/v1/appointments')
    .set({ ...bearer('pat_1'), 'Idempotency-Key': `pay-book-${Date.now()}-${fee}` })
    .send({
      doctorId: String(doctor._id),
      appointmentTypeId: String(apptType._id),
      startTime: new Date(Date.now() + 7200_000).toISOString(),
      timezone: 'Asia/Kolkata',
      payOnline: true,
    });
  assert.equal(bookRes.status, 201);
  return bookRes.body.data.appointment;
};

describe('Stage 8A: Razorpay Online Payments', () => {
  it('bypasses payment for free appointments', async () => {
    const appt = await seedDoctorAndBookPaid(0);
    assert.equal(appt.status, 'CONFIRMED');
    assert.equal(appt.paymentStatus, 'NOT_REQUIRED');
  });

  it('creates order in paise, rejects bad signature, verifies real signature -> confirms appointment, and refunds', async () => {
    const appt = await seedDoctorAndBookPaid(500);
    assert.equal(appt.status, 'PAYMENT_PENDING');
    assert.equal(appt.paymentStatus, 'PENDING');

    let orderCalls = 0;
    mock.method(razorpayClientGateway, 'createOrder', async ({ amountPaise, currency }) => {
      orderCalls += 1;
      assert.equal(amountPaise, 50000);
      assert.equal(currency, 'INR');
      return { id: 'order_test_1', amount: amountPaise, currency };
    });

    // Create order twice -> idempotent, only 1 Razorpay order created
    const ord1 = await request(app)
      .post('/api/v1/payments/create-order')
      .set(bearer('pat_1'))
      .send({ appointmentId: appt.id });
    assert.equal(ord1.status, 201);
    assert.equal(ord1.body.data.order.id, 'order_test_1');
    assert.equal(ord1.body.data.keyId, 'rzp_test_key');

    const ord2 = await request(app)
      .post('/api/v1/payments/create-order')
      .set(bearer('pat_1'))
      .send({ appointmentId: appt.id });
    assert.equal(ord2.status, 201);
    assert.equal(orderCalls, 1);

    // Invalid signature is rejected
    const badVerify = await request(app)
      .post('/api/v1/payments/verify')
      .set(bearer('pat_1'))
      .send({
        appointmentId: appt.id,
        razorpayPaymentId: 'pay_test_1',
        razorpaySignature: '00'.repeat(32),
      });
    assert.equal(badVerify.status, 400);
    assert.equal(badVerify.body.code, 'INVALID_PAYMENT_SIGNATURE');

    // Valid signature + captured provider status -> Payment CAPTURED & Appointment CONFIRMED
    const validSig = crypto
      .createHmac('sha256', 'rzp_test_secret')
      .update('order_test_1|pay_test_1', 'utf8')
      .digest('hex');

    mock.method(razorpayClientGateway, 'fetchPayment', async () => ({
      id: 'pay_test_1',
      status: 'captured',
      amount: 50000,
    }));

    const verifyRes = await request(app)
      .post('/api/v1/payments/verify')
      .set(bearer('pat_1'))
      .send({
        appointmentId: appt.id,
        razorpayPaymentId: 'pay_test_1',
        razorpaySignature: validSig,
      });
    assert.equal(verifyRes.status, 200);
    assert.equal(verifyRes.body.data.payment.status, 'CAPTURED');
    const paymentId = verifyRes.body.data.payment.id;

    const updatedAppt = await fakeAppointments.repo.findById(appt.id);
    assert.equal(updatedAppt.status, 'CONFIRMED');
    assert.equal(updatedAppt.paymentStatus, 'PAID');

    // Out-of-order payment.failed webhook does NOT downgrade CAPTURED
    const failPayload = JSON.stringify({
      event: 'payment.failed',
      payload: { payment: { entity: { id: 'pay_test_1', order_id: 'order_test_1' } } },
    });
    const whSig = crypto.createHmac('sha256', 'rzp_webhook_secret').update(failPayload, 'utf8').digest('hex');
    const whRes = await request(app)
      .post('/api/v1/webhooks/razorpay')
      .set('Content-Type', 'application/json')
      .set('X-Razorpay-Signature', whSig)
      .set('x-razorpay-event-id', 'evt_fail_1')
      .send(failPayload);
    assert.equal(whRes.status, 200);
    assert.equal((await fakePayments.repo.findById(paymentId)).status, 'CAPTURED');

    // Duplicate webhook ignored
    const whDup = await request(app)
      .post('/api/v1/webhooks/razorpay')
      .set('Content-Type', 'application/json')
      .set('X-Razorpay-Signature', whSig)
      .set('x-razorpay-event-id', 'evt_fail_1')
      .send(failPayload);
    assert.equal(whDup.body.data.duplicate, true);

    // Refund requires cancelled appointment first -> cancel then refund
    mock.method(calendlyClient, 'cancelScheduledEvent', async () => ({ resource: {} }));
    await request(app)
      .post(`/api/v1/appointments/${appt.id}/cancel`)
      .set(bearer('pat_1'))
      .send({ reason: 'Cannot attend' });

    mock.method(razorpayClientGateway, 'refundPayment', async () => ({
      id: 'rfnd_test_1',
      status: 'processed',
    }));
    const refundRes = await request(app)
      .post(`/api/v1/payments/${paymentId}/refund`)
      .set(bearer('pat_1'))
      .send({ reason: 'Cancelled before visit' });
    assert.equal(refundRes.status, 200);
    assert.equal(refundRes.body.data.payment.status, 'REFUNDED');

    // Duplicate refund prevented
    const dupRefund = await request(app)
      .post(`/api/v1/payments/${paymentId}/refund`)
      .set(bearer('pat_1'))
      .send({ reason: 'Again' });
    assert.equal(dupRefund.status, 409);
  });
});
