import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import mongoose from 'mongoose';
import { ApiError } from '../../../utils/ApiError.js';

const BUCKET_NAME = 'medicalDocuments';

const getBucket = () => {
  const db = mongoose.connection?.db;
  if (!db) {
    throw new ApiError(503, 'Database storage is unavailable', 'STORAGE_UNAVAILABLE');
  }
  return new mongoose.mongo.GridFSBucket(db, { bucketName: BUCKET_NAME });
};

export const documentStorageService = {
  async uploadEncryptedBuffer(buffer, metadata = {}) {
    const bucket = getBucket();
    const internalFilename = `meddoc_${randomUUID()}`;
    return new Promise((resolve, reject) => {
      const uploadStream = bucket.openUploadStream(internalFilename, { metadata });
      uploadStream.on('error', reject);
      uploadStream.on('finish', () => resolve(uploadStream.id));
      Readable.from(buffer).pipe(uploadStream);
    });
  },

  async downloadEncryptedBuffer(gridFsFileId) {
    const bucket = getBucket();
    const fileId = typeof gridFsFileId === 'string' ? new mongoose.Types.ObjectId(gridFsFileId) : gridFsFileId;
    return new Promise((resolve, reject) => {
      const chunks = [];
      const downloadStream = bucket.openDownloadStream(fileId);
      downloadStream.on('data', (chunk) => chunks.push(chunk));
      downloadStream.on('error', reject);
      downloadStream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  },

  async deleteFile(gridFsFileId) {
    const bucket = getBucket();
    const fileId = typeof gridFsFileId === 'string' ? new mongoose.Types.ObjectId(gridFsFileId) : gridFsFileId;
    await bucket.delete(fileId);
  },
};
