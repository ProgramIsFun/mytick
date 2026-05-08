const fs = require('fs');
const path = require('path');
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

async function main() {
  loadEnv(path.join(__dirname, '.env'));
  if (!process.env.BW_CLIENTSECRET) { console.error('BW_CLIENTSECRET not found'); process.exit(1); }

  const secretId = process.argv[2];
  if (!secretId) { console.error('Usage: node sm-get.js <secret-id>'); process.exit(1); }

  const bw = new BitwardenClient({
    apiUrl: 'https://api.bitwarden.com',
    identityUrl: 'https://identity.bitwarden.com',
    userAgent: 'sm-get/1.0'
  }, LogLevel.Info);
  await bw.auth().loginAccessToken(process.env.BW_CLIENTSECRET);

  const secret = await bw.secrets().get(secretId);
  console.log(secret.value);
}

if (require.main === module) main().catch(err => { console.error(err.message); process.exit(1); });
