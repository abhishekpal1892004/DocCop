import './setup.js';
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { getAbdmRuntimeConfig } from '../src/integrations/abdm/abdm.config.js';
import { abdmCrypto } from '../src/integrations/abdm/abdm.crypto.js';
import { abdmClient } from '../src/integrations/abdm/abdm.client.js';
import { abdmTokenService } from '../src/integrations/abdm/abdm.token.service.js';

describe('Stage 11A - ABDM Integration Foundation', () => {
  afterEach(() => {
    delete process.env.ABDM_ENABLED;
    delete process.env.ABDM_CLIENT_ID;
    delete process.env.ABDM_CLIENT_SECRET;
    abdmTokenService.clearCachedToken();
  });

  it('keeps external connectivity disabled by default and blocks live ABDM calls', async () => {
    const cfg = getAbdmRuntimeConfig();
    assert.equal(cfg.enabled, false);
    assert.equal(cfg.isExternalConnectivityReady, false);

    await assert.rejects(
      () => abdmClient.lookupHprProfile('HPR-12345'),
      (err) => err.statusCode === 503 && err.code === 'ABDM_EXTERNAL_DISABLED'
    );
  });

  it('encrypts, decrypts, hashes, and masks ABHA identifiers securely', () => {
    const abhaNumber = '91-1234-5678-9012';
    const abhaAddress = 'ananya.sharma@sbx';

    const encrypted = abdmCrypto.encrypt(abhaNumber);
    assert.ok(encrypted && encrypted !== abhaNumber);
    assert.equal(abdmCrypto.decrypt(encrypted), abhaNumber);
    assert.equal(abdmCrypto.maskAbhaNumber(abhaNumber), 'XX-XXXX-XXXX-9012');
    assert.equal(abdmCrypto.maskAbhaAddress(abhaAddress), 'an***@sbx');
    assert.equal(abdmCrypto.hashIdentifier('Ananya.Sharma@SBX'), abdmCrypto.hashIdentifier(abhaAddress));
  });
});
