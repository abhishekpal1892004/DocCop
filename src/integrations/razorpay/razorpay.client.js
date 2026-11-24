import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';

let cachedInstance = null;
let cachedKey = null;

export const getRazorpayCredentials = () => {
  const keyId = process.env.RAZORPAY_KEY_ID || env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET || env.RAZORPAY_KEY_SECRET;
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || env.RAZORPAY_WEBHOOK_SECRET;
  return { keyId, keySecret, webhookSecret };
};

export const razorpayClientGateway = {
  getClient() {
    const { keyId, keySecret } = getRazorpayCredentials();
    if (!keyId || !keySecret) {
      throw new ApiError(503, 'Razorpay credentials are not configured', 'RAZORPAY_NOT_CONFIGURED');
    }
    const pair = `${keyId}:${keySecret}`;
    if (!cachedInstance || cachedKey !== pair) {
      cachedInstance = new Razorpay({ key_id: keyId, key_secret: keySecret });
      cachedKey = pair;
    }
    return cachedInstance;
  },

  createOrder({ amountPaise, currency = 'INR', receipt, notes = {} }) {
    const client = this.getClient();
    return client.orders.create({
      amount: amountPaise,
      currency,
      receipt,
      notes,
    });
  },

  fetchPayment(razorpayPaymentId) {
    const client = this.getClient();
    return client.payments.fetch(razorpayPaymentId);
  },

  refundPayment(razorpayPaymentId, { amountPaise, notes = {} } = {}) {
    const client = this.getClient();
    return client.payments.refund(razorpayPaymentId, {
      ...(amountPaise ? { amount: amountPaise } : {}),
      notes,
    });
  },

  verifyCheckoutSignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
    const { keySecret } = getRazorpayCredentials();
    if (!keySecret) {
      throw new ApiError(503, 'Razorpay key secret is not configured', 'RAZORPAY_NOT_CONFIGURED');
    }
    const expected = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`, 'utf8')
      .digest('hex');

    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(String(razorpaySignature ?? ''), 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  },

  verifyWebhookSignature(rawBody, signatureHeader) {
    const { webhookSecret } = getRazorpayCredentials();
    if (!webhookSecret) {
      throw new ApiError(503, 'Razorpay webhook secret is not configured', 'RAZORPAY_NOT_CONFIGURED');
    }
    const rawText = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody ?? '');
    const expected = crypto.createHmac('sha256', webhookSecret).update(rawText, 'utf8').digest('hex');
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(String(signatureHeader ?? ''), 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  },
};
