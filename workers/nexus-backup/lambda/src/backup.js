const https = require('https');
const http = require('http');
const { URL } = require('url');

/**
 * Fetch databases that need backup from project API
 */
async function fetchDatabases(project) {
  const url = new URL('/databases/backupable', project.apiUrl);
  
  return new Promise((resolve, reject) => {
    const protocol = url.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${project.serviceToken}`
      }
    };

    const req = protocol.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`API returned ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Backup a single project
 */
async function backupProject(project) {
  const { getBitwardenSecret } = require('./bitwarden');
  const { backupMongoDB } = require('./backup/mongodb');
  
  // Fetch list of databases to backup
  const databases = await fetchDatabases(project);
  console.log(`Found ${databases.length} databases to backup for ${project.name}`);

  const results = {
    databases: [],
    totalSize: 0
  };

  for (const db of databases) {
    try {
      // Get connection string from Bitwarden
      const bitwardenRef = db.secretRefs?.find(ref => ref.provider === 'bitwarden');
      if (!bitwardenRef) {
        console.warn(`No Bitwarden secret ref for ${db.name}, skipping`);
        continue;
      }

      const connectionString = await getBitwardenSecret(bitwardenRef.itemId, bitwardenRef.field);
      
      // Backup based on database type
      let backupResult;
      switch (db.type) {
        case 'mongodb':
          backupResult = await backupMongoDB(db.name, connectionString, project.name);
          break;
        default:
          console.warn(`Unsupported database type: ${db.type}`);
          continue;
      }

      results.databases.push({
        name: db.name,
        type: db.type,
        size: backupResult.size,
        path: backupResult.s3Path
      });
      
      results.totalSize += backupResult.size;
      
      console.log(`Successfully backed up ${db.name} (${backupResult.size} bytes)`);
      
    } catch (error) {
      console.error(`Failed to backup ${db.name}:`, error);
      results.databases.push({
        name: db.name,
        error: error.message
      });
    }
  }

  return results;
}

module.exports = { backupProject, fetchDatabases };
