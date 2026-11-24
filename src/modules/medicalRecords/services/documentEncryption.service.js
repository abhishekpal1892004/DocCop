import crypto from 'node:crypto';
import { env } from '../../../config/env.js';
import { ApiError } from '../../../utils/ApiError.js';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

/**
 * Verifies actual file signature (magic bytes) rather than trusting file extension or MIME header.
 */
export const detectFileSignatureMime = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return null;
  // PDF: %PDF-
  if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
    return 'application/pdf';
  }
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }
  return null;
};

const resolveKeyForVersion = (version) => {
  const envName = `MEDICAL_DOC_ENCRYPTION_KEY_${String(version).toUpperCase()}`;
  const raw = process.env[envName] || env[envName];
  if (!raw) {
    if (env.isTest) {
      return crypto.createHash('sha256').update(`medibook-test-doc-key-${version}`).digest();
    }
    throw new ApiError(503, `Medical document encryption key (${version}) is not configured`, 'ENCRYPTION_NOT_CONFIGURED');
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  return crypto.createHash('sha256').update(raw, 'utf8').digest();
};

export const documentEncryptionService = {
  getActiveKeyVersion() {
    return process.env.MEDICAL_DOC_ENCRYPTION_ACTIVE_VERSION || env.MEDICAL_DOC_ENCRYPTION_ACTIVE_VERSION || 'v1';
  },

  computeChecksum(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  },

  encryptBuffer(plaintextBuffer) {
    const keyVersion = this.getActiveKeyVersion();
    const key = resolveKeyForVersion(keyVersion);
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintextBuffer), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return {
      encryptedBuffer: encrypted,
      encryptionKeyVersion: keyVersion,
      iv: iv.toString('base64url'),
      authTag: authTag.toString('base64url'),
      checksum: this.computeChecksum(plaintextBuffer),
    };
  },

  decryptBuffer(encryptedBuffer, { encryptionKeyVersion, iv, authTag }) {
    const key = resolveKeyForVersion(encryptionKeyVersion);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(authTag, 'base64url'));
    return Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
  },
};
