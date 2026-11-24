import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import { calendlyClient } from '../../integrations/calendly/calendly.client.js';
import { getRazorpayCredentials, razorpayClientGateway } from '../../integrations/razorpay/razorpay.client.js';
import { APPOINTMENT_PAYMENT_STATUS, APPOINTMENT_STATUS } from '../appointments/appointment.constants.js';
import { appointmentRepository } from '../appointments/appointment.repository.js';
import { calendlyRepository } from '../calendly/calendly.repository.js';
import { getValidCalendlyAccess } from '../calendly/calendly.service.js';
import { NOTIFICATION_EVENT_TYPES } from '../notifications/notification.constants.js';
import { emitAppointmentNotificationEvent } from '../notifications/services/notification.service.js';
import { ROLES } from '../users/user.constants.js';
import { PAYMENT_STATUS, PAYMENT_STATUS_RANK } from './payment.constants.js';
import { paymentRepository } from './payment.repository.js';

export const toPublicPayment = (p) => ({
  id: String(p._id),
  patientId: String(p.patientId),
  doctorId: String(p.doctorId),
  appointmentId: String(p.appointmentId),
  razorpayOrderId: p.razorpayOrderId ?? null,
  razorpayPaymentId: p.razorpayPaymentId ?? null,
  refundId: p.refundId ?? null,
  amountPaise: p.amount,
  amountRupees: Number((p.amount / 100).toFixed(2)),
  currency: p.currency,
  status: p.status,
  signatureVerified: Boolean(p.signatureVerified),
  capturedAt: p.capturedAt ?? null,
  failedAt: p.failedAt ?? null,
  refundAmountPaise: p.refundAmount ?? 0,
  refundReason: p.refundReason ?? null,
  refundedAt: p.refundedAt ?? null,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
});

export const createPaymentOrder = async (user, { appointmentId }) => {
  const appt = await appointmentRepository.findById(appointmentId);
  if (!appt) throw new ApiError(404, 'Appointment not found', 'APPOINTMENT_NOT_FOUND');
  if (String(appt.patientId) !== String(user._id)) {
    throw new ApiError(403, 'You can only pay for your own appointments', 'FORBIDDEN');
  }
  if (appt.status === APPOINTMENT_STATUS.CANCELLED) {
    throw new ApiError(409, 'Cannot pay for a cancelled appointment', 'INVALID_APPOINTMENT_STATUS');
  }
  if (appt.paymentStatus === APPOINTMENT_PAYMENT_STATUS.PAID) {
    throw new ApiError(409, 'Appointment is already paid', 'ALREADY_PAID');
  }

  // Idempotency: return existing active order if already created.
  const existing = await paymentRepository.findActiveOrderForAppointment(appt._id);
  const { keyId } = getRazorpayCredentials();
  if (existing) {
    return {
      payment: toPublicPayment(existing),
      order: { id: existing.razorpayOrderId, amount: existing.amount, currency: existing.currency },
      keyId: keyId ?? null,
    };
  }

  // Always derive consultation fee from trusted database records.
  const apptType = await calendlyRepository.findAppointmentTypeById(appt.appointmentTypeId);
  const feeRupees = Number(apptType?.consultationFee ?? appt.consultationFee ?? 0);
  if (feeRupees <= 0) {
    throw new ApiError(400, 'No payment is required for a free appointment', 'PAYMENT_NOT_REQUIRED');
  }

  const amountPaise = Math.round(feeRupees * 100);
  const currency = env.RAZORPAY_PAYMENT_CURRENCY || 'INR';

  const order = await razorpayClientGateway.createOrder({
    amountPaise,
    currency,
    receipt: `mb_${String(appt._id).slice(-12)}`,
    notes: {
      appointmentId: String(appt._id),
      patientId: String(user._id),
      doctorId: String(appt.doctorId),
    },
  });

  const payment = await paymentRepository.create({
    patientId: user._id,
    doctorId: appt.doctorId,
    appointmentId: appt._id,
    razorpayOrderId: order.id,
    amount: amountPaise,
    currency,
    status: PAYMENT_STATUS.CREATED,
  });

  return {
    payment: toPublicPayment(payment),
    order: { id: order.id, amount: amountPaise, currency },
    keyId: keyId ?? null,
  };
};

const markPaymentCapturedAndConfirmAppointment = async (payment, razorpayPaymentId) => {
  const now = new Date();
  const updatedPayment = await paymentRepository.updateById(payment._id, {
    razorpayPaymentId,
    status: PAYMENT_STATUS.CAPTURED,
    signatureVerified: true,
    capturedAt: payment.capturedAt ?? now,
  });

  const appt = await appointmentRepository.findById(payment.appointmentId);
  if (appt && appt.status === APPOINTMENT_STATUS.PAYMENT_PENDING) {
    const confirmedAppt = await appointmentRepository.updateById(appt._id, {
      status: APPOINTMENT_STATUS.CONFIRMED,
      paymentStatus: APPOINTMENT_PAYMENT_STATUS.PAID,
    });
    await emitAppointmentNotificationEvent({
      appointment: confirmedAppt,
      eventType: NOTIFICATION_EVENT_TYPES.APPOINTMENT_CONFIRMED,
    });
  } else if (appt && appt.paymentStatus !== APPOINTMENT_PAYMENT_STATUS.PAID) {
    await appointmentRepository.updateById(appt._id, {
      paymentStatus: APPOINTMENT_PAYMENT_STATUS.PAID,
    });
  }

  return updatedPayment;
};

export const verifyCheckoutPayment = async (user, { appointmentId, razorpayPaymentId, razorpaySignature }) => {
  const payment = await paymentRepository.findActiveOrderForAppointment(appointmentId);
  if (!payment) throw new ApiError(404, 'Payment order not found for appointment', 'PAYMENT_NOT_FOUND');
  if (String(payment.patientId) !== String(user._id)) {
    throw new ApiError(403, 'You are not authorized to verify this payment', 'FORBIDDEN');
  }
  if (payment.status === PAYMENT_STATUS.CAPTURED) {
    return toPublicPayment(payment);
  }

  // Verify signature using the trusted razorpayOrderId stored in MongoDB.
  const validSig = razorpayClientGateway.verifyCheckoutSignature({
    razorpayOrderId: payment.razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  });
  if (!validSig) {
    throw new ApiError(400, 'Invalid Razorpay payment signature', 'INVALID_PAYMENT_SIGNATURE');
  }

  // Confirm actual payment status server-to-server.
  const providerPayment = await razorpayClientGateway.fetchPayment(razorpayPaymentId);
  if (providerPayment?.status !== 'captured' || Number(providerPayment?.amount) !== Number(payment.amount)) {
    throw new ApiError(409, 'Payment is not captured for the expected order amount', 'PAYMENT_NOT_CAPTURED');
  }

  const updated = await markPaymentCapturedAndConfirmAppointment(payment, razorpayPaymentId);
  return toPublicPayment(updated);
};

export const getPaymentById = async (user, id) => {
  const payment = await paymentRepository.findById(id);
  if (!payment) throw new ApiError(404, 'Payment not found', 'PAYMENT_NOT_FOUND');
  if (user.role !== ROLES.ADMIN && String(payment.patientId) !== String(user._id)) {
    throw new ApiError(403, 'You are not authorized to view this payment', 'FORBIDDEN');
  }
  return toPublicPayment(payment);
};

export const listMyPayments = async (user, query) => {
  const result = await paymentRepository.listByPatient(user._id, query);
  return {
    payments: result.items.map(toPublicPayment),
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / result.limit) || 0,
    },
  };
};

export const initiatePaymentRefund = async (user, id, { reason }) => {
  const payment = await paymentRepository.findById(id);
  if (!payment) throw new ApiError(404, 'Payment not found', 'PAYMENT_NOT_FOUND');
  if (user.role !== ROLES.ADMIN && String(payment.patientId) !== String(user._id)) {
    throw new ApiError(403, 'You are not authorized to refund this payment', 'FORBIDDEN');
  }
  if (
    payment.status === PAYMENT_STATUS.REFUNDED ||
    payment.status === PAYMENT_STATUS.REFUND_PENDING
  ) {
    throw new ApiError(409, 'Refund has already been initiated or completed for this payment', 'ALREADY_REFUNDED');
  }
  if (payment.status !== PAYMENT_STATUS.CAPTURED || !payment.razorpayPaymentId) {
    throw new ApiError(409, 'Only captured payments are eligible for refund', 'PAYMENT_NOT_REFUNDABLE');
  }

  const appt = await appointmentRepository.findById(payment.appointmentId);
  if (!appt || (appt.status !== APPOINTMENT_STATUS.CANCELLED && user.role !== ROLES.ADMIN)) {
    throw new ApiError(
      409,
      'Appointment must be cancelled before requesting a refund',
      'REFUND_POLICY_NOT_MET'
    );
  }

  const refund = await razorpayClientGateway.refundPayment(payment.razorpayPaymentId, {
    amountPaise: payment.amount,
    notes: { reason, appointmentId: String(payment.appointmentId) },
  });

  const nextStatus = refund?.status === 'processed' ? PAYMENT_STATUS.REFUNDED : PAYMENT_STATUS.REFUND_PENDING;
  const updated = await paymentRepository.updateById(payment._id, {
    refundId: refund?.id,
    refundAmount: payment.amount,
    refundReason: reason,
    status: nextStatus,
    ...(nextStatus === PAYMENT_STATUS.REFUNDED ? { refundedAt: new Date() } : {}),
  });

  await appointmentRepository.updateById(payment.appointmentId, {
    paymentStatus: APPOINTMENT_PAYMENT_STATUS.REFUNDED,
  });

  return toPublicPayment(updated);
};

export const expireUnpaidAppointment = async (appointmentId) => {
  const appt = await appointmentRepository.findById(appointmentId);
  if (!appt || appt.status !== APPOINTMENT_STATUS.PAYMENT_PENDING) return null;
  if (appt.paymentDeadlineAt && new Date(appt.paymentDeadlineAt) > new Date()) return appt;

  if (appt.calendlyEventUri) {
    try {
      const { accessToken } = await getValidCalendlyAccess(appt.doctorId);
      await calendlyClient.cancelScheduledEvent(accessToken, appt.calendlyEventUri, 'Payment window expired');
    } catch {
      return appointmentRepository.updateById(appt._id, {
        status: APPOINTMENT_STATUS.REQUIRES_RECONCILIATION,
      });
    }
  }

  return appointmentRepository.updateById(appt._id, {
    status: APPOINTMENT_STATUS.CANCELLED,
    paymentStatus: APPOINTMENT_PAYMENT_STATUS.FAILED,
    cancellationReason: 'Payment window expired',
  });
};

export const processRazorpayWebhook = async ({ rawBody, signatureHeader, eventId }) => {
  if (!signatureHeader || !razorpayClientGateway.verifyWebhookSignature(rawBody, signatureHeader)) {
    throw new ApiError(400, 'Invalid Razorpay webhook signature', 'INVALID_WEBHOOK_SIGNATURE');
  }

  let body;
  try {
    const text = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody ?? '');
    body = JSON.parse(text);
  } catch {
    throw new ApiError(400, 'Malformed Razorpay webhook JSON', 'INVALID_JSON');
  }

  const eventType = body?.event ?? 'unknown';
  const payEntity = body?.payload?.payment?.entity;
  const refundEntity = body?.payload?.refund?.entity;
  const orderEntity = body?.payload?.order?.entity;
  const orderId = payEntity?.order_id ?? orderEntity?.id ?? null;
  const paymentId = payEntity?.id ?? refundEntity?.payment_id ?? null;
  const dedupId = eventId || `${eventType}:${paymentId ?? orderId}:${body?.created_at ?? ''}`;

  const existing = await paymentRepository.findWebhookByEventId(dedupId);
  if (existing && existing.processingStatus === 'PROCESSED') {
    return { duplicate: true, status: 'PROCESSED' };
  }

  const inbox =
    existing ??
    (await paymentRepository.createWebhookEvent({
      eventId: dedupId,
      eventType,
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      processingStatus: 'RECEIVED',
    }));

  const payment =
    (orderId ? await paymentRepository.findByOrderId(orderId) : null) ??
    (paymentId ? await paymentRepository.findByPaymentId(paymentId) : null);

  if (!payment) {
    await paymentRepository.updateWebhookById(inbox._id, {
      processingStatus: 'IGNORED',
      processingResult: 'No matching local payment record',
    });
    return { duplicate: false, status: 'IGNORED' };
  }

  let result = 'Processed';
  if (eventType === 'payment.captured' || eventType === 'order.paid') {
    if ((PAYMENT_STATUS_RANK[payment.status] ?? 0) < PAYMENT_STATUS_RANK.CAPTURED) {
      await markPaymentCapturedAndConfirmAppointment(payment, paymentId ?? payment.razorpayPaymentId);
    }
    result = 'Payment marked CAPTURED';
  } else if (eventType === 'payment.authorized') {
    if ((PAYMENT_STATUS_RANK[payment.status] ?? 0) < PAYMENT_STATUS_RANK.AUTHORIZED) {
      await paymentRepository.updateById(payment._id, {
        razorpayPaymentId: paymentId,
        status: PAYMENT_STATUS.AUTHORIZED,
      });
    }
    result = 'Payment marked AUTHORIZED';
  } else if (eventType === 'payment.failed') {
    // Do not overwrite an already CAPTURED payment with an older failed event.
    if ((PAYMENT_STATUS_RANK[payment.status] ?? 0) < PAYMENT_STATUS_RANK.CAPTURED) {
      await paymentRepository.updateById(payment._id, {
        razorpayPaymentId: paymentId,
        status: PAYMENT_STATUS.FAILED,
        failedAt: new Date(),
        failureReason: payEntity?.error_description ?? 'Payment failed',
      });
      result = 'Payment marked FAILED';
    } else {
      result = 'Ignored out-of-order payment.failed';
    }
  } else if (eventType === 'refund.processed') {
    await paymentRepository.updateById(payment._id, {
      status: PAYMENT_STATUS.REFUNDED,
      refundedAt: new Date(),
    });
    result = 'Refund marked REFUNDED';
  }

  await paymentRepository.updateWebhookById(inbox._id, {
    processingStatus: 'PROCESSED',
    processingResult: result,
  });

  return { duplicate: false, status: 'PROCESSED', result };
};
