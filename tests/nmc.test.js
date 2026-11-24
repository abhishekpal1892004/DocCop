import { signSessionToken } from './setup.js';
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createFakeUserRepository } from './helpers/fakeUserRepository.js';
import { createFakeDoctorApplicationRepository, createFakeNmcLookupRepository } from './helpers/fakeDoctorRepositories.js';

const { createNmcClient, NmcProviderError, nmcClient } = await import('../src/integrations/nmc/nmc.client.js');
const { evaluateLookup } = await import('../src/integrations/nmc/nmc.matcher.js');
const { mapNmcResponse } = await import('../src/integrations/nmc/nmc.mapper.js');
const { default: app } = await import('../src/app.js');
const { userRepository } = await import('../src/modules/users/user.repository.js');
const { doctorApplicationRepository } = await import('../src/modules/doctorApplications/doctorApplication.repository.js');
const { nmcLookupRepository } = await import('../src/modules/doctorVerification/nmcLookup.repository.js');
const { clerkGateway } = await import('../src/integrations/clerk/clerk.gateway.js');

const sampleApiBody = {
  success: true,
  data: [
    {
      id: 1,
      name: 'ASHA RAO',
      father_name: 'PRIVATE FATHER NAME',
      dob: '1990-01-01',
      registration_no: '012345',
      registration_date: '14-06-2018',
      uprn_no: 'UPRN1',
      state_medical_council: 'Uttar Pradesh Medical Council',
      state_code: 'UP',
      year_of_info: 2018,
      permanent_address: 'PRIVATE HOME ADDRESS',
      qualification: 'MBBS',
      qualification_year: '2017',
      university: 'KGMU',
      additional_qualifications: [],
      removed_status: '0',
    },
  ],
  pagination: { total: 1, count: 1, per_page: 25, current_page: 1, total_pages: 1 },
};

describe('NMC Client & Mapper', () => {
  it('sends expected query parameters with no cookies and strips private fields', async () => {
    let captured;
    const client = createNmcClient({
      httpClient: {
        get: async (url, config) => {
          captured = { url, config };
          return { status: 200, headers: { 'content-type': 'application/json' }, data: JSON.stringify(sampleApiBody) };
        },
      },
    });

    const result = await client.search({ name: 'Asha Rao', registrationNumber: '12345', registrationYear: 2018, state: 'UP' });
    assert.deepEqual(captured.config.params, {
      search_type: 'advance',
      name: 'Asha Rao',
      reg_no: '12345',
      year: 2018,
      state: 'UP',
      page: 1,
      per_page: 25,
    });
    assert.equal(captured.config.headers.Cookie, undefined);
    assert.equal(result.records.length, 1);
    assert.equal(result.records[0].registrationYear, 2018);
    assert.equal('father_name' in result.records[0], false);
    assert.equal('permanent_address' in result.records[0], false);
    assert.equal('dob' in result.records[0], false);
  });

  it('handles timeouts, non-JSON, invalid JSON, and provider auth/server errors', async () => {
    const mk = (impl) => createNmcClient({ httpClient: { get: impl } });

    await assert.rejects(
      () => mk(async () => { throw Object.assign(new Error('timeout'), { code: 'ECONNABORTED' }); }).search({}),
      (e) => e instanceof NmcProviderError && e.reason === 'TIMEOUT'
    );
    await assert.rejects(
      () => mk(async () => ({ status: 200, headers: { 'content-type': 'text/html' }, data: '<html></html>' })).search({}),
      (e) => e instanceof NmcProviderError && e.reason === 'NOT_JSON'
    );
    await assert.rejects(
      () => mk(async () => ({ status: 200, headers: { 'content-type': 'application/json' }, data: '{bad' })).search({}),
      (e) => e instanceof NmcProviderError && e.reason === 'INVALID_JSON'
    );
    for (const status of [401, 403, 419, 429, 502]) {
      await assert.rejects(
        () => mk(async () => ({ status, headers: {}, data: '' })).search({}),
        (e) => e instanceof NmcProviderError
      );
    }
  });
});

describe('NMC Matching Logic', () => {
  const baseRecord = mapNmcResponse(sampleApiBody).records[0];
  const baseQuery = { name: 'Dr. Asha Rao', registrationNumber: '12345', registrationYear: 2018, state: 'UP' };

  it('returns MATCH_FOUND when number, council, year, and name align', () => {
    const res = evaluateLookup(baseQuery, [baseRecord]);
    assert.equal(res.lookupStatus, 'MATCH_FOUND');
  });

  it('detects registration number mismatch (name similarity alone is never enough)', () => {
    const res = evaluateLookup(baseQuery, [{ ...baseRecord, registrationNumber: '99999' }]);
    assert.equal(res.lookupStatus, 'NO_MATCH');
  });

  it('detects year mismatch when both values exist', () => {
    const res = evaluateLookup(baseQuery, [{ ...baseRecord, registrationYear: 2015 }]);
    assert.equal(res.lookupStatus, 'PARTIAL_MATCH');
  });

  it('detects state mismatch', () => {
    const res = evaluateLookup(baseQuery, [{ ...baseRecord, stateCode: 'MAH' }]);
    assert.equal(res.lookupStatus, 'PARTIAL_MATCH');
  });

  it('does not assume missing provider fields match', () => {
    const res = evaluateLookup(baseQuery, [{ ...baseRecord, registrationYear: null }]);
    assert.equal(res.lookupStatus, 'MANUAL_REVIEW_REQUIRED');
    assert.equal(res.results[0].comparison.registrationYear, 'NOT_AVAILABLE');
  });

  it('handles empty results without flagging as fraudulent', () => {
    const res = evaluateLookup(baseQuery, []);
    assert.equal(res.lookupStatus, 'NO_MATCH');
    assert.match(res.summary, /manual review/i);
  });
});

describe('POST /api/v1/doctor-verification/nmc-check', () => {
  const bearer = (id) => ({ Authorization: `Bearer ${signSessionToken(id)}` });
  let fakeUsers;
  let fakeApps;
  let fakeLookups;
  let origUserRepo;
  let origAppRepo;
  let origLookupRepo;

  beforeEach(async () => {
    fakeUsers = createFakeUserRepository();
    fakeApps = createFakeDoctorApplicationRepository();
    fakeLookups = createFakeNmcLookupRepository();
    origUserRepo = { ...userRepository };
    origAppRepo = { ...doctorApplicationRepository };
    origLookupRepo = { ...nmcLookupRepository };
    Object.assign(userRepository, fakeUsers.repo);
    Object.assign(doctorApplicationRepository, fakeApps.repo);
    Object.assign(nmcLookupRepository, fakeLookups.repo);

    mock.method(clerkGateway, 'getUser', async (id) => ({
      id,
      firstName: 'Asha',
      lastName: 'Rao',
      primaryEmailAddressId: 'e1',
      emailAddresses: [{ id: 'e1', emailAddress: `${id}@example.com`, verification: { status: 'verified' } }],
      phoneNumbers: [],
      updatedAt: 1000,
    }));

    await request(app).post('/api/v1/users/onboard').set(bearer('doc_nmc')).send({ accountType: 'DOCTOR' });
    await request(app).post('/api/v1/doctor-applications').set(bearer('doc_nmc')).send({
      personalDetails: { fullName: 'Dr. Asha Rao', phoneNumber: '+919876543210' },
      professionalDetails: { medicalSystem: 'MODERN_MEDICINE' },
      medicalRegistration: { councilName: 'Uttar Pradesh Medical Council', registrationNumber: '12345', registrationYear: 2018, stateCode: 'UP' },
    });
  });

  afterEach(() => {
    Object.assign(userRepository, origUserRepo);
    Object.assign(doctorApplicationRepository, origAppRepo);
    Object.assign(nmcLookupRepository, origLookupRepo);
    mock.restoreAll();
  });

  it('returns PROVIDER_UNAVAILABLE gracefully when NMC fails, without exposing provider errors', async () => {
    mock.method(nmcClient, 'search', async () => {
      throw new NmcProviderError('ACCESS_DENIED', 'HTTP 403 internal token info');
    });
    const res = await request(app).post('/api/v1/doctor-verification/nmc-check').set(bearer('doc_nmc')).send({
      name: 'Dr. Asha Rao',
      registrationNumber: '12345',
      registrationYear: 2018,
      state: 'UP',
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.lookupStatus, 'PROVIDER_UNAVAILABLE');
    assert.equal(res.body.data.manualReviewRequired, true);
    assert.ok(!JSON.stringify(res.body).includes('HTTP 403'));
    assert.ok(!JSON.stringify(res.body).includes('internal token info'));
  });

  it('routes non-allopathic systems to MANUAL_REVIEW_REQUIRED without calling NMC', async () => {
    let called = false;
    mock.method(nmcClient, 'search', async () => { called = true; return { records: [], total: 0 }; });
    await request(app)
      .patch('/api/v1/doctor-applications/me')
      .set(bearer('doc_nmc'))
      .send({ professionalDetails: { medicalSystem: 'AYURVEDA' } });

    const res = await request(app).post('/api/v1/doctor-verification/nmc-check').set(bearer('doc_nmc')).send({
      name: 'Dr. Asha Rao',
      registrationNumber: '12345',
      registrationYear: 2018,
      state: 'UP',
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.lookupStatus, 'MANUAL_REVIEW_REQUIRED');
    assert.equal(called, false);
  });

  it('rejects lookups whose details do not match the saved application', async () => {
    const res = await request(app).post('/api/v1/doctor-verification/nmc-check').set(bearer('doc_nmc')).send({
      name: 'Dr. Asha Rao',
      registrationNumber: '99999',
      registrationYear: 2018,
      state: 'UP',
    });
    assert.equal(res.status, 409);
    assert.equal(res.body.code, 'REGISTRATION_DETAILS_MISMATCH');
  });
});
