/**
 * Local test script for Bitwarden Secrets Manager integration.
 *
 * Setup:
 *   Create a .env file in this directory with:
 *     BW_CLIENTSECRET=<machine-account-access-token>
 *     BW_ORG_ID=<bitwarden-organization-id>
 *     BW_PROJECT_ID=<bitwarden-project-id>  (needed for create)
 *
 * Commands:
 *   node test-bitwarden.js list                          - list secrets
 *   node test-bitwarden.js get <secret-id>               - get a secret value
 *   node test-bitwarden.js create <key> <value>          - create a secret
 *   node test-bitwarden.js delete <secret-id>            - delete a secret
 */

const fs = require('fs');
const path = require('path');

try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
} catch {}

const { BitwardenClient } = require('@bitwarden/sdk-napi');
const { LogLevel } = require('@bitwarden/sdk-napi/binding');

async function getClient() {
  const client = new BitwardenClient({
    apiUrl: "https://api.bitwarden.com",
    identityUrl: "https://identity.bitwarden.com",
    userAgent: "nexus-backup-test/1.0"
  }, LogLevel.Info);
  await client.auth().loginAccessToken(process.env.BW_CLIENTSECRET);
  return client;
}

async function cmdList() {
  const orgId = process.env.BW_ORG_ID;
  if (!orgId) { console.error('Error: BW_ORG_ID required for list'); process.exit(1); }
  console.log('Listing secrets...\n');
  const client = await getClient();
  const res = await client.secrets().list(orgId);
  if (!res.data?.length) {
    console.log('No secrets found.');
    return;
  }
  for (const s of res.data) {
    console.log(`  ${s.id}  ${s.key}  (rev ${s.revisionDate})`);
  }
  console.log(`\nTotal: ${res.data.length} secrets`);
}

async function cmdGet(secretId) {
  console.log(`Fetching secret: ${secretId}...`);
  const client = await getClient();
  const res = await client.secrets().get(secretId);
  if (!res?.id) throw new Error('Secret not found');
  console.log(`\n  Key:   ${res.key}`);
  console.log(`  Value: ${res.value}`);
  console.log(`  Note:  ${res.note || '(none)'}`);
}

async function cmdCreate(key, value) {
  const orgId = process.env.BW_ORG_ID;
  const projectId = process.env.BW_PROJECT_ID;
  if (!orgId) { console.error('Error: BW_ORG_ID required for create'); process.exit(1); }
  if (!projectId) { console.error('Error: BW_PROJECT_ID required for create'); process.exit(1); }
  console.log(`Creating secret: ${key}...`);
  const client = await getClient();
  const res = await client.secrets().create(orgId, key, value, 'test from nexus-backup', [projectId]);
  console.log(`\nCreated: ${res.id}`);
  console.log(`  Key:   ${res.key}`);
  console.log(`  Value: ${res.value}`);
}

async function cmdDelete(secretId) {
  console.log(`Deleting secret: ${secretId}...`);
  const client = await getClient();
  const res = await client.secrets().delete([secretId]);
  const result = res.data?.[0];
  if (result?.error) throw new Error(result.error);
  console.log('Deleted successfully.');
}

async function main() {
  if (!process.env.BW_CLIENTSECRET) {
    console.error('Error: BW_CLIENTSECRET required in .env');
    process.exit(1);
  }

  const cmd = process.argv[2];

  if (cmd === 'list') {
    await cmdList();
  } else if (cmd === 'get') {
    if (!process.argv[3]) { console.error('Usage: node test-bitwarden.js get <secret-id>'); process.exit(1); }
    await cmdGet(process.argv[3]);
  } else if (cmd === 'create') {
    if (!process.argv[3] || !process.argv[4]) { console.error('Usage: node test-bitwarden.js create <key> <value>'); process.exit(1); }
    await cmdCreate(process.argv[3], process.argv[4]);
  } else if (cmd === 'delete') {
    if (!process.argv[3]) { console.error('Usage: node test-bitwarden.js delete <secret-id>'); process.exit(1); }
    await cmdDelete(process.argv[3]);
  } else {
    console.error('Usage: node test-bitwarden.js <list|get|create|delete> [args...]');
    process.exit(1);
  }
}

main().catch(err => { console.error(`\nError: ${err.message}`); process.exit(1); });
