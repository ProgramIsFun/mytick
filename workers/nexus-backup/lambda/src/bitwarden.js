const { BitwardenClient, DeviceType, LogLevel } = require('@bitwarden/sdk-node');

let client = null;

/**
 * Initialize Bitwarden SDK client with service account
 */
async function initBitwardenClient() {
  if (client) return client;

  const clientSecret = process.env.BW_CLIENTSECRET;

  if (!clientSecret) {
    throw new Error('BW_CLIENTSECRET environment variable required');
  }

  client = new BitwardenClient({
    deviceType: DeviceType.SDK,
    logLevel: LogLevel.Info
  });

  // Login with service account access token
  await client.auth().loginAccessToken(clientSecret, null);

  console.log('Bitwarden client initialized');
  return client;
}

/**
 * Get secret from Bitwarden vault
 * @param {string} itemId - Bitwarden item UUID
 * @param {string} field - Optional field name within the item
 */
async function getBitwardenSecret(itemId, field = null) {
  const bw = await initBitwardenClient();
  
  try {
    const item = await bw.vault().get(itemId);
    
    if (!item) {
      throw new Error(`Item ${itemId} not found in vault`);
    }

    // If it's a secure note, return the notes field
    if (item.type === 2) {
      return item.notes;
    }

    // If it's a login item
    if (item.login) {
      if (field) {
        return item.login[field] || item.login.password;
      }
      return item.login.password || item.login.username;
    }

    throw new Error(`Unsupported item type for ${itemId}`);
    
  } catch (error) {
    console.error(`Error fetching secret ${itemId}:`, error);
    throw error;
  }
}

module.exports = { initBitwardenClient, getBitwardenSecret };
