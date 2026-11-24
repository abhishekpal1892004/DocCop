import twilio from 'twilio';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';

let cachedClient = null;
let cachedCredsKey = null;

export const getTwilioCredentials = () => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID || env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN || env.TWILIO_AUTH_TOKEN;
  return { accountSid, authToken };
};

export const twilioClientGateway = {
  getClient() {
    const { accountSid, authToken } = getTwilioCredentials();
    if (!accountSid || !authToken) {
      throw new ApiError(503, 'Twilio credentials are not configured', 'TWILIO_NOT_CONFIGURED');
    }
    const key = `${accountSid}:${authToken}`;
    if (!cachedClient || cachedCredsKey !== key) {
      cachedClient = twilio(accountSid, authToken);
      cachedCredsKey = key;
    }
    return cachedClient;
  },

  async createMessage(payload) {
    const client = this.getClient();
    return client.messages.create(payload);
  },

  validateRequest(signature, url, params) {
    const { authToken } = getTwilioCredentials();
    if (!authToken) {
      throw new ApiError(503, 'Twilio Auth Token is not configured', 'TWILIO_NOT_CONFIGURED');
    }
    return twilio.validateRequest(authToken, signature, url, params);
  },
};
