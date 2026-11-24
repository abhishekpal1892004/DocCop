import './setup.js';
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';

const { default: app } = await import('../src/app.js');
const { errorHandler } = await import('../src/middleware/error.middleware.js');
const { asyncHandler } = await import('../src/utils/asyncHandler.js');
const { ApiError } = await import('../src/utils/ApiError.js');
const { validate } = await import('../src/middleware/validate.middleware.js');
const { z } = await import('zod');

describe('GET /api/v1/health/live', () => {
  it('returns 200 with standard success shape', async () => {
    const res = await request(app).get('/api/v1/health/live');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.status, 'ok');
    assert.ok(res.headers['x-content-type-options'], 'helmet headers present');
  });
});

describe('GET /api/v1/health/ready', () => {
  it('returns 503 when the database is not connected', async () => {
    const res = await request(app).get('/api/v1/health/ready');
    assert.equal(res.status, 503);
    assert.equal(res.body.success, false);
    assert.equal(res.body.code, 'SERVICE_UNAVAILABLE');
    assert.equal(res.body.data.checks.database, 'down');
  });

  it('returns 200 when the database reports connected', async () => {
    const original = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');
    Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });
    try {
      const res = await request(app).get('/api/v1/health/ready');
      assert.equal(res.status, 200);
      assert.equal(res.body.data.checks.database, 'up');
    } finally {
      if (original) Object.defineProperty(mongoose.connection, 'readyState', original);
      else delete mongoose.connection.readyState;
    }
  });
});

describe('404 handling', () => {
  it('returns standard error for unknown routes', async () => {
    const res = await request(app).get('/api/v1/nope');
    assert.equal(res.status, 404);
    assert.deepEqual(Object.keys(res.body).sort(), ['code', 'message', 'success']);
    assert.equal(res.body.code, 'ROUTE_NOT_FOUND');
  });
});

describe('CORS', () => {
  it('rejects disallowed origins', async () => {
    const res = await request(app).get('/api/v1/health/live').set('Origin', 'http://evil.example');
    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'CORS_ORIGIN_NOT_ALLOWED');
  });
  it('allows configured origins', async () => {
    const res = await request(app).get('/api/v1/health/live').set('Origin', 'http://localhost:5173');
    assert.equal(res.status, 200);
    assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:5173');
  });
});

describe('Centralized error handling', () => {
  let testApp;
  before(() => {
    testApp = express();
    testApp.use(express.json());
    testApp.get('/api-error', (_req, _res, next) => next(ApiError.badRequest('bad', 'BAD_THING')));
    testApp.get('/boom', asyncHandler(async () => { throw new Error('mongodb://user:secret@host leaked'); }));
    testApp.get('/dup', () => { throw Object.assign(new Error('E11000'), { code: 11000, keyPattern: { email: 1 } }); });
    testApp.post('/zod', validate({ body: z.object({ name: z.string() }) }), (_req, res) => res.json({}));
    testApp.use(errorHandler);
  });

  it('handles ApiError', async () => {
    const res = await request(testApp).get('/api-error');
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'BAD_THING');
  });

  it('hides internals for unexpected errors', async () => {
    const { env } = await import('../src/config/env.js');
    assert.equal(env.isProduction, false);
    const res = await request(testApp).get('/boom');
    assert.equal(res.status, 500);
    assert.equal(res.body.code, 'INTERNAL_SERVER_ERROR');
    assert.equal(res.body.message, 'Something went wrong');
    assert.ok(!res.body.message.includes('secret'));
  });

  it('handles duplicate key errors', async () => {
    const res = await request(testApp).get('/dup');
    assert.equal(res.status, 409);
    assert.equal(res.body.code, 'DUPLICATE_KEY');
  });

  it('handles invalid ObjectId (CastError)', async () => {
    const err = new mongoose.Error.CastError('ObjectId', 'bad-id', '_id');
    const t = express();
    t.get('/', (_req, _res, next) => next(err));
    t.use(errorHandler);
    const res = await request(t).get('/');
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'INVALID_ID');
  });

  it('handles Zod validation errors', async () => {
    const res = await request(testApp).post('/zod').send({ name: 5 });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'VALIDATION_ERROR');
    assert.ok(Array.isArray(res.body.details));
  });

  it('handles Mongoose validation errors', async () => {
    const M = mongoose.model('V', new mongoose.Schema({ a: { type: String, required: true } }));
    const err = await new M({}).validate().catch((e) => e);
    const t = express();
    t.get('/', (_req, _res, next) => next(err));
    t.use(errorHandler);
    const res = await request(t).get('/');
    mongoose.deleteModel('V');
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'VALIDATION_ERROR');
  });

  it('handles malformed JSON on the real app', async () => {
    const res = await request(app)
      .post('/api/v1/health/live')
      .set('Content-Type', 'application/json')
      .send('{"bad":');
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'MALFORMED_JSON');
  });
});
