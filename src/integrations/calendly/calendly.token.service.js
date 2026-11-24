import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

const resolveEncryptionKey = () => {
  const raw = process.env.CALENDLY_TOKEN_ENCRYPTION_KEY || env.CALENDLY_TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    if (env.isTest) {
      return crypto.createHash('sha256').update('medibook-test-calendly-key').digest();
    }
    throw new ApiError(503, 'Calendly token encryption key is not configured', 'CALENDLY_NOT_CONFIGURED');
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  return crypto.createHash('sha256').update(raw, 'utf8').digest();
};

export const calendlyTokenService = {
  encrypt(plaintext) {
    if (!plaintext) return null;
    const key = resolveEncryptionKey();
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
  },

  decrypt(payload) {
    if (!payload) return null;
    const parts = String(payload).split('.');
    if (parts.length !== 3) {
      throw new ApiError(500, 'Stored Calendly credential is corrupted', 'CREDENTIAL_DECRYPT_ERROR');
    }
    const [ivB64, tagB64, dataB64] = parts;
    const key = resolveEncryptionKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64url')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  },
};
