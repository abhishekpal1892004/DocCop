import mongoose from 'mongoose';
import { env } from './env.js';

let listenersAttached = false;

const attachListeners = () => {
  if (listenersAttached) return;
  listenersAttached = true;
  mongoose.connection.on('connected', () => console.log('[db] MongoDB connected'));
  mongoose.connection.on('disconnected', () => console.warn('[db] MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => console.log('[db] MongoDB reconnected'));
  mongoose.connection.on('error', (err) => console.error('[db] MongoDB error:', err.name));
};

export const connectDatabase = async () => {
  attachListeners();
  mongoose.set('strictQuery', true);
  try {
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
    });
  } catch (err) {
    // Do not log the URI (may contain credentials).
    throw new Error(`Failed to connect to MongoDB: ${err.name}: ${err.message.replace(/\/\/[^@\s]*@/g, '//***@')}`);
  }
  return mongoose.connection;
};

export const disconnectDatabase = async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
};

/** True when Mongoose reports an active connection (readyState 1). */
export const isDatabaseReady = () => mongoose.connection.readyState === 1;
