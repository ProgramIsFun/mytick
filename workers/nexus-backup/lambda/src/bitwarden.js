const { BitwardenClient } = require('@bitwarden/sdk-napi');
const { LogLevel } = require('@bitwarden/sdk-napi/binding');

let client = null;

/**
 * Initialize Bitwarden Secrets Manager client
 */
async function initBitwardenClient() {
  if (client) return client;

  const accessToken = process.env.BW_CLIENTSECRET;

  if (!accessToken) {
    throw new Error('BW_CLIENTSECRET environment variable required');
  }

  try {
    client = new BitwardenClient({
      apiUrl: "https://api.bitwarden.com",
      identityUrl: "https://identity.bitwarden.com",
      userAgent: "nexus-backup/1.0"
    }, LogLevel.Info);

    // Login with access token (Secrets Manager token)
    await client.auth().loginAccessToken(accessToken);

    console.log('Bitwarden Secrets Manager client initialized');
    return client;
  } catch (error) {
    console.error('Failed to initialize Bitwarden client:', error);
    throw error;
  }
}

/**
 * Get secret from Bitwarden Secrets Manager
 * @param {string} secretId - Secret UUID (not vault item ID)
 */
async function getBitwardenSecret(secretId) {
  const bw = await initBitwardenClient();
  
  try {
    const response = await bw.secrets().get(secretId);
    
    if (!response || !response.data) {
      throw new Error(`Secret ${secretId} not found`);
    }

    // Return the secret value
    return response.data.value;
    
  } catch (error) {
    console.error(`Error fetching secret ${secretId}:`, error.message);
    throw error;
  }
}

module.exports = { initBitwardenClient, getBitwardenSecret };

