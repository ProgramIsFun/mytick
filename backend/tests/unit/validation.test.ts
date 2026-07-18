import { describe, it, expect } from '@jest/globals';
import {
  createAccountSchema,
  updateAccountSchema,
  createDomainSchema,
  updateDomainSchema,
  createDatabaseSchema,
  updateDatabaseSchema,
  backupCompletedSchema,
  createSubscriptionSchema,
  updateSubscriptionSchema,
  createSecretSchema,
  updateSecretSchema,
  upsertContextSchema,
} from '../../src/utils/validation';

/* eslint-disable @typescript-eslint/no-explicit-any */
function shouldPass(schema: any, data: unknown) {
  expect(schema.safeParse(data).success).toBe(true);
}

function shouldFail(schema: any, data: unknown) {
  expect(schema.safeParse(data).success).toBe(false);
}

// ── Accounts ────────────────────────────────────────────────────────────────

describe('createAccountSchema', () => {
  it('accepts valid minimal payload', () => {
    shouldPass(createAccountSchema, { name: 'AWS', provider: 'aws' });
  });

  it('accepts full payload', () => {
    shouldPass(createAccountSchema, {
      name: 'AWS Root',
      provider: 'aws',
      parentAccountId: null,
      url: 'https://aws.amazon.com',
      username: 'admin',
      notes: 'root account',
      tags: ['cloud'],
      credentials: [{ key: 'AKIA', secretId: 's1' }],
    });
  });

  it('rejects empty name', () => shouldFail(createAccountSchema, { name: '', provider: 'aws' }));
  it('rejects missing provider', () => shouldFail(createAccountSchema, { name: 'AWS' }));
  it('rejects name too long', () => shouldFail(createAccountSchema, { name: 'x'.repeat(201), provider: 'aws' }));
  it('rejects tag > 50 chars', () =>
    shouldFail(createAccountSchema, { name: 'OK', provider: 'aws', tags: ['x'.repeat(51)] }));
  it('rejects > 20 tags', () =>
    shouldFail(createAccountSchema, { name: 'OK', provider: 'aws', tags: Array(21).fill('a') }));
});

describe('updateAccountSchema', () => {
  it('accepts partial update', () => shouldPass(updateAccountSchema, { name: 'New Name' }));
  it('accepts empty body', () => shouldPass(updateAccountSchema, {}));
  it('rejects empty name', () => shouldFail(updateAccountSchema, { name: '' }));
});

// ── Domains ─────────────────────────────────────────────────────────────────

describe('createDomainSchema', () => {
  it('accepts valid minimal payload', () => shouldPass(createDomainSchema, { name: 'example.com' }));

  it('accepts full payload', () => {
    shouldPass(createDomainSchema, {
      name: 'example.com',
      projectId: null,
      registrarAccountId: 'r1',
      dnsAccountId: 'd1',
      expiryDate: '2026-12-31T00:00:00.000Z',
      autoRenew: true,
      nameservers: ['ns1.example.com'],
      sslProvider: 'letsencrypt',
      notes: 'main domain',
      tags: ['production'],
    });
  });

  it('rejects empty name', () => shouldFail(createDomainSchema, { name: '' }));
  it('rejects invalid expiryDate', () =>
    shouldFail(createDomainSchema, { name: 'ok.com', expiryDate: 'not-a-date' }));
  it('rejects > 10 nameservers', () =>
    shouldFail(createDomainSchema, { name: 'ok.com', nameservers: Array(11).fill('ns.com') }));
});

describe('updateDomainSchema', () => {
  it('accepts partial update', () => shouldPass(updateDomainSchema, { autoRenew: false }));
  it('accepts empty body', () => shouldPass(updateDomainSchema, {}));
  it('rejects empty name', () => shouldFail(updateDomainSchema, { name: '' }));
});

// ── Databases ───────────────────────────────────────────────────────────────

describe('createDatabaseSchema', () => {
  it('accepts valid minimal payload', () =>
    shouldPass(createDatabaseSchema, { name: 'Prod DB', type: 'mongodb' }));

  it('accepts full payload', () => {
    shouldPass(createDatabaseSchema, {
      name: 'Prod DB',
      type: 'postgres',
      secretId: 's1',
      host: 'db.example.com',
      port: 5432,
      database: 'mydb',
      backupEnabled: true,
      backupRetentionDays: 30,
      backupFrequency: 'daily',
      accountId: 'a1',
      tags: ['prod'],
      notes: 'primary database',
    });
  });

  it('rejects empty name', () => shouldFail(createDatabaseSchema, { name: '', type: 'mongodb' }));
  it('rejects invalid type', () => shouldFail(createDatabaseSchema, { name: 'DB', type: 'oracle' }));
  it('rejects port > 65535', () =>
    shouldFail(createDatabaseSchema, { name: 'DB', type: 'redis', port: 99999 }));
  it('rejects port < 0', () =>
    shouldFail(createDatabaseSchema, { name: 'DB', type: 'redis', port: -1 }));
  it('rejects backupRetentionDays < 1', () =>
    shouldFail(createDatabaseSchema, { name: 'DB', type: 'redis', backupRetentionDays: 0 }));
  it('rejects invalid backupFrequency', () =>
    shouldFail(createDatabaseSchema, { name: 'DB', type: 'redis', backupFrequency: 'monthly' }));
});

describe('updateDatabaseSchema', () => {
  it('accepts partial update', () => shouldPass(updateDatabaseSchema, { name: 'Renamed' }));
  it('accepts empty body', () => shouldPass(updateDatabaseSchema, {}));
  it('rejects invalid type', () => shouldFail(updateDatabaseSchema, { type: 'oracle' }));
});

describe('backupCompletedSchema', () => {
  it('accepts valid minimal payload', () => {
    shouldPass(backupCompletedSchema, {
      status: 'success',
      startedAt: '2026-01-01T00:00:00.000Z',
      completedAt: '2026-01-01T00:01:00.000Z',
    });
  });

  it('accepts full payload', () => {
    shouldPass(backupCompletedSchema, {
      status: 'failed',
      startedAt: '2026-01-01T00:00:00.000Z',
      completedAt: '2026-01-01T00:05:00.000Z',
      sizeBytes: 1048576,
      s3Path: 'backups/db/2026-01-01',
      s3Bucket: 'my-backups',
      errorMessage: 'timeout',
      metadata: { engine: 'pg14' },
      triggeredBy: 'manual',
      lambdaRequestId: 'req-123',
    });
  });

  it('rejects invalid status', () =>
    shouldFail(backupCompletedSchema, { status: 'pending', startedAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-01T00:01:00.000Z' }));
  it('rejects missing startedAt', () =>
    shouldFail(backupCompletedSchema, { status: 'success', completedAt: '2026-01-01T00:01:00.000Z' }));
  it('rejects invalid date format', () =>
    shouldFail(backupCompletedSchema, { status: 'success', startedAt: 'yesterday', completedAt: '2026-01-01T00:01:00.000Z' }));
  it('rejects negative sizeBytes', () =>
    shouldFail(backupCompletedSchema, { status: 'success', startedAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-01T00:01:00.000Z', sizeBytes: -1 }));
});

// ── Subscriptions ───────────────────────────────────────────────────────────

describe('createSubscriptionSchema', () => {
  it('accepts valid minimal payload', () => {
    shouldPass(createSubscriptionSchema, { name: 'Netflix', provider: 'Netflix', amount: 15.99, billingCycle: 'monthly' });
  });

  it('accepts full payload', () => {
    shouldPass(createSubscriptionSchema, {
      name: 'Netflix',
      provider: 'Netflix',
      amount: 15.99,
      currency: 'USD',
      billingCycle: 'monthly',
      nextBillingDate: '2026-02-01T00:00:00.000Z',
      expiryDate: '2026-12-31T00:00:00.000Z',
      autoRenew: true,
      status: 'active',
      category: 'entertainment',
      paymentMethod: 'visa',
      url: 'https://netflix.com',
      notes: 'family plan',
      tags: ['streaming'],
    });
  });

  it('rejects missing name', () => shouldFail(createSubscriptionSchema, { provider: 'N', amount: 10, billingCycle: 'monthly' }));
  it('rejects missing provider', () => shouldFail(createSubscriptionSchema, { name: 'N', amount: 10, billingCycle: 'monthly' }));
  it('rejects missing amount', () => shouldFail(createSubscriptionSchema, { name: 'N', provider: 'N', billingCycle: 'monthly' }));
  it('rejects negative amount', () => shouldFail(createSubscriptionSchema, { name: 'N', provider: 'N', amount: -5, billingCycle: 'monthly' }));
  it('rejects missing billingCycle', () => shouldFail(createSubscriptionSchema, { name: 'N', provider: 'N', amount: 10 }));
  it('rejects currency != 3 chars', () => shouldFail(createSubscriptionSchema, { name: 'N', provider: 'N', amount: 10, billingCycle: 'monthly', currency: 'US' }));
  it('rejects invalid nextBillingDate', () =>
    shouldFail(createSubscriptionSchema, { name: 'N', provider: 'N', amount: 10, billingCycle: 'monthly', nextBillingDate: 'bad' }));
});

describe('updateSubscriptionSchema', () => {
  it('accepts partial update', () => shouldPass(updateSubscriptionSchema, { amount: 20 }));
  it('accepts empty body', () => shouldPass(updateSubscriptionSchema, {}));
  it('rejects negative amount', () => shouldFail(updateSubscriptionSchema, { amount: -1 }));
});

// ── Secrets ─────────────────────────────────────────────────────────────────

describe('createSecretSchema', () => {
  it('accepts valid payload', () => {
    shouldPass(createSecretSchema, {
      name: 'DB Password',
      provider: 'bitwarden',
      secretValue: 'bw-123',
      type: 'password',
    });
  });

  it('rejects empty name', () =>
    shouldFail(createSecretSchema, { name: '', provider: 'bitwarden', secretValue: 'x', type: 'password' }));
  it('rejects invalid provider', () =>
    shouldFail(createSecretSchema, { name: 'X', provider: 'aws_ssm', secretValue: 'x', type: 'password' }));
  it('rejects invalid type', () =>
    shouldFail(createSecretSchema, { name: 'X', provider: 'bitwarden', secretValue: 'x', type: 'oauth_token' }));
  it('rejects missing secretValue', () =>
    shouldFail(createSecretSchema, { name: 'X', provider: 'bitwarden', type: 'password' }));
  it('rejects invalid expiresAt', () =>
    shouldFail(createSecretSchema, { name: 'X', provider: 'bitwarden', secretValue: 'x', type: 'password', expiresAt: 'not-date' }));
});

describe('updateSecretSchema', () => {
  it('accepts partial update', () => shouldPass(updateSecretSchema, { name: 'New Name' }));
  it('accepts empty body', () => shouldPass(updateSecretSchema, {}));
  it('rejects invalid provider', () => shouldFail(updateSecretSchema, { provider: 'bad' }));
  it('rejects invalid type', () => shouldFail(updateSecretSchema, { type: 'bad' }));
});

// ── Context ─────────────────────────────────────────────────────────────────

describe('upsertContextSchema', () => {
  it('accepts a string value', () => shouldPass(upsertContextSchema, { value: 'hello world' }));
  it('accepts empty string', () => shouldPass(upsertContextSchema, { value: '' }));
  it('rejects missing value', () => shouldFail(upsertContextSchema, {}));
  it('rejects number value', () => shouldFail(upsertContextSchema, { value: 123 }));
  it('rejects object value', () => shouldFail(upsertContextSchema, { value: {} }));
  it('rejects null value', () => shouldFail(upsertContextSchema, { value: null }));
});
