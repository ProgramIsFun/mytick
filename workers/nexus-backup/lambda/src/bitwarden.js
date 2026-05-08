const { BitwardenClient } = require('@bitwarden/sdk-napi');
const { LogLevel } = require('@bitwarden/sdk-napi/binding');

let client = null;

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

    await client.auth().loginAccessToken(accessToken);

    console.log('Bitwarden Secrets Manager client initialized');
    return client;
  } catch (error) {
    console.error('Failed to initialize Bitwarden client:', error);
    throw error;
  }
}

async function getBitwardenSecret(secretId) {
  const bw = await initBitwardenClient();

  try {
    const secret = await bw.secrets().get(secretId);

    if (!secret || !secret.id) {
      throw new Error(`Secret ${secretId} not found`);
    }

    return secret.value;

  } catch (error) {
    console.error(`Error fetching secret ${secretId}:`, error.message);
    throw error;
  }
}

async function getBitwardenSecretFull(secretId) {
  const bw = await initBitwardenClient();

  try {
    const secret = await bw.secrets().get(secretId);

    if (!secret || !secret.id) {
      throw new Error(`Secret ${secretId} not found`);
    }

    return secret;

  } catch (error) {
    console.error(`Error fetching secret ${secretId}:`, error.message);
    throw error;
  }
}

async function createBitwardenSecret(orgId, key, value, note) {
  const bw = await initBitwardenClient();

  try {
    const projects = await bw.projects().list(orgId);
    const projectIds = projects.data.length > 0 ? [projects.data[0].id] : [];

    const secret = await bw.secrets().create(orgId, key, value, note, projectIds);

    if (!secret || !secret.id) {
      throw new Error('Failed to create secret: no ID returned');
    }

    console.log(`Bitwarden secret created: ${secret.id}`);
    return secret;

  } catch (error) {
    console.error('Error creating secret:', error.message);
    throw error;
  }
}

async function updateBitwardenSecret(orgId, secretId, key, value, note, projectIds) {
  const bw = await initBitwardenClient();

  try {
    const secret = await bw.secrets().update(orgId, secretId, key, value, note, projectIds);

    if (!secret || !secret.id) {
      throw new Error(`Failed to update secret ${secretId}: no ID returned`);
    }

    console.log(`Bitwarden secret updated: ${secret.id}`);
    return secret;

  } catch (error) {
    console.error(`Error updating secret ${secretId}:`, error.message);
    throw error;
  }
}

async function deleteBitwardenSecret(secretIds) {
  const bw = await initBitwardenClient();

  try {
    const result = await bw.secrets().delete(secretIds);

    if (!result || !result.data) {
      throw new Error('Failed to delete secrets: no response data');
    }

    const failed = result.data.filter(d => d.error);
    if (failed.length > 0) {
      console.error('Some secrets failed to delete:', failed);
    }

    console.log(`Bitwarden secrets deleted: ${secretIds.join(', ')}`);
    return result;

  } catch (error) {
    console.error('Error deleting secrets:', error.message);
    throw error;
  }
}

async function listBitwardenProjects(orgId) {
  const bw = await initBitwardenClient();

  try {
    const projects = await bw.projects().list(orgId);

    if (!projects || !projects.data) {
      throw new Error('Failed to list projects: no response data');
    }

    return projects.data;

  } catch (error) {
    console.error('Error listing projects:', error.message);
    throw error;
  }
}

async function listBitwardenSecrets(orgId) {
  const bw = await initBitwardenClient();

  try {
    const result = await bw.secrets().list(orgId);

    if (!result || !result.data) {
      throw new Error('Failed to list secrets: no response data');
    }

    return result.data;

  } catch (error) {
    console.error('Error listing secrets:', error.message);
    throw error;
  }
}

module.exports = {
  initBitwardenClient,
  getBitwardenSecret,
  getBitwardenSecretFull,
  createBitwardenSecret,
  updateBitwardenSecret,
  deleteBitwardenSecret,
  listBitwardenProjects,
  listBitwardenSecrets
};
