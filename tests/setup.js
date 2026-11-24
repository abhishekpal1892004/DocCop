// Must be imported before any src module so env validation passes without real services.
import { generateKeyPairSync, createSign, createHmac } from 'node:crypto';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/medibook-test';
process.env.CLIENT_ORIGINS = 'http://localhost:5173';

// Dummy, test-only Clerk configuration. Sessions are verified networklessly against a
// locally generated key pair, so no Clerk account or network access is needed.
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
process.env.CLERK_PUBLISHABLE_KEY = `pk_test_${Buffer.from('clerk.test.example.com$').toString('base64')}`;
process.env.CLERK_SECRET_KEY = 'sk_test_dummy_not_a_real_key';
process.env.CLERK_JWT_KEY = publicKey.export({ type: 'spki', format: 'pem' });

export const WEBHOOK_SECRET_RAW = 'test-webhook-signing-secret-bytes';
export const WEBHOOK_SECRET = `whsec_${Buffer.from(WEBHOOK_SECRET_RAW).toString('base64')}`;
process.env.CLERK_WEBHOOK_SIGNING_SECRET = WEBHOOK_SECRET;

const b64url = (v) => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');

/** Create a Clerk-shaped session JWT signed with the test key. */
export const signSessionToken = (userId, { expiresInSec = 300, key = privateKey } = {}) => {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url({ alg: 'RS256', typ: 'JWT', kid: 'test-key', cat: 'cl_B7d4PD111AAA' });
  const payload = b64url({ sub: userId, sid: `sess_${userId}`, iat: now, nbf: now - 5, exp: now + expiresInSec, iss: 'https://clerk.test.example.com' });
  const sig = createSign('RSA-SHA256').update(`${header}.${payload}`).sign(key).toString('base64url');
  return `${header}.${payload}.${sig}`;
};

/** Sign a Svix-style webhook delivery. */
export const signWebhook = (body, { id = 'msg_test1', timestamp = Math.floor(Date.now() / 1000), secret = WEBHOOK_SECRET_RAW } = {}) => {
  const signature = createHmac('sha256', secret).update(`${id}.${timestamp}.${body}`).digest('base64');
  return { 'svix-id': id, 'svix-timestamp': String(timestamp), 'svix-signature': `v1,${signature}`, 'content-type': 'application/json' };
};
