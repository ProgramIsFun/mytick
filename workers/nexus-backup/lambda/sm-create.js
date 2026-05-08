const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');
const { BitwardenClient } = require('@bitwarden/sdk-napi');
const { LogLevel } = require('@bitwarden/sdk-napi/binding');

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

function ask(query) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(query, a => { rl.close(); resolve(a); }));
}

async function main() {
  loadEnv(path.join(__dirname, '.env'));
  if (!process.env.BW_CLIENTSECRET) { console.error('BW_CLIENTSECRET not found in .env'); process.exit(1); }
  if (!process.env.BW_ORG_ID) { console.error('BW_ORG_ID not found in .env'); process.exit(1); }

  const bw = new BitwardenClient({
    apiUrl: 'https://api.bitwarden.com',
    identityUrl: 'https://identity.bitwarden.com',
    userAgent: 'sm-create/1.0'
  }, LogLevel.Info);
  await bw.auth().loginAccessToken(process.env.BW_CLIENTSECRET);

  const value = await ask('Secret value: ');

  const projects = await bw.projects().list(process.env.BW_ORG_ID);
  const projectIds = projects.data.length > 0 ? [projects.data[0].id] : [];

  const created = await bw.secrets().create(process.env.BW_ORG_ID, crypto.randomUUID(), value, '', projectIds);
  console.log('\n' + created.id);
}

if (require.main === module) {
  main().catch(err => { console.error(err.message); process.exit(1); });
}
