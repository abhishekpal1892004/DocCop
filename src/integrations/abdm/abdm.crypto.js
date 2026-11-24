import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

const resolveAbdmKey = () => {
  const raw = process.env.ABDM_ENCRYPTION_KEY || env.ABDM_ENCRYPTION_KEY;
  if (!raw) {
    if (env.isTest) {
      return crypto.createHash('sha256').update('medibook-test-abdm-key').digest();
    }
    throw new ApiError(503, 'ABDM encryption key is not configured', 'ABDM_ENCRYPTION_NOT_CONFIGURED');
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  return crypto.createHash('sha256').update(raw, 'utf8').digest();
};

export const abdmCrypto = {
  encrypt(plaintext) {
    if (!plaintext) return null;
    const key = resolveAbdmKey();
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
      throw new ApiError(500, 'Stored ABDM identifier is corrupted', 'ABDM_DECRYPT_ERROR');
    }
    const [ivB64, tagB64, dataB64] = parts;
    const key = resolveAbdmKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64url')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  },

  hashIdentifier(value) {
    if (!value) return null;
    const normalized = String(value).trim().toLowerCase();
    return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
  },

  maskAbhaNumber(abhaNumber) {
    if (!abhaNumber) return null;
    const digits = String(abhaNumber).replace(/\D/g, '');
    if (digits.length < 4) return '****';
    return `XX-XXXX-XXXX-${digits.slice(-4)}`;
  },

  maskAbhaAddress(abhaAddress) {
    if (!abhaAddress) return null;
    const [local, domain] = String(abhaAddress).split('@');
    if (!domain) return '***';
    const prefix = local.slice(0, Math.min(2, local.length));
    return `${prefix}***@${domain}`;
  },
};
