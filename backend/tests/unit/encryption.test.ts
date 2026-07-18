import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

const VALID_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('encryption service', () => {
  let encrypt: typeof import('../../src/services/encryption').encrypt;
  let decrypt: typeof import('../../src/services/encryption').decrypt;

  beforeAll(() => {
    process.env.ENCRYPTION_KEY = VALID_KEY;
    ({ encrypt, decrypt } = require('../../src/services/encryption'));
  });

  afterAll(() => {
    delete process.env.ENCRYPTION_KEY;
  });

  it('should roundtrip plaintext through encrypt/decrypt', () => {
    const plaintext = 'super-secret-password-123';
    const ciphertext = encrypt(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it('should roundtrip empty string', () => {
    const ciphertext = encrypt('');
    expect(decrypt(ciphertext)).toBe('');
  });

  it('should roundtrip unicode', () => {
    const plaintext = '日本語パスワード🔑';
    const ciphertext = encrypt(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it('should roundtrip long values', () => {
    const plaintext = 'x'.repeat(10000);
    const ciphertext = encrypt(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it('should produce different ciphertext each time (random IV)', () => {
    const plaintext = 'same-input';
    const c1 = encrypt(plaintext);
    const c2 = encrypt(plaintext);
    expect(c1).not.toBe(c2);
  });

  it('should fail to decrypt with wrong key', () => {
    const ciphertext = encrypt('secret');
    const origKey = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const { decrypt: decrypt2 } = require('../../src/services/encryption');
    expect(() => decrypt2(ciphertext)).toThrow();
    process.env.ENCRYPTION_KEY = origKey;
  });

  it('should fail to decrypt tampered ciphertext', () => {
    const ciphertext = encrypt('secret');
    const buf = Buffer.from(ciphertext, 'base64');
    buf[buf.length - 1] ^= 0xff;
    const tampered = buf.toString('base64');
    expect(() => decrypt(tampered)).toThrow();
  });
});

describe('encryption service - missing key', () => {
  it('should throw when ENCRYPTION_KEY is not set', () => {
    delete process.env.ENCRYPTION_KEY;
    jest.resetModules();
    const { encrypt: enc } = require('../../src/services/encryption');
    expect(() => enc('test')).toThrow('ENCRYPTION_KEY env var is required');
  });
});
