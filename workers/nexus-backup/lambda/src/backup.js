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
 * Report backup completion to MyTick API
 * 
 * DESIGN DECISION: Report after EACH database backup (not batched)
 * 
 * Why per-database reporting?
 * 1. Real-time visibility - Users see progress as it happens
 * 2. Lambda timeout protection - 15min limit, save progress incrementally
 * 3. Partial failure tracking - Know which specific databases failed
 * 4. Crash resilience - If Lambda crashes, completed backups are recorded
 * 5. Better debugging - Exact timestamps and errors per database
 * 
 * Trade-off: More API calls (N databases = N calls), but worth it for production resilience
 */
async function reportBackupResult(project, databaseId, result) {
  const url = new URL(`/databases/${databaseId}/backup-completed`, project.apiUrl);
  
  return new Promise((resolve, reject) => {
    const protocol = url.protocol === 'https:' ? https : http;
    const body = JSON.stringify(result);
    
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${project.serviceToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = protocol.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data));
        } else {
          console.error(`Failed to report backup: ${res.statusCode} ${data}`);
          reject(new Error(`API returned ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (err) => {
      console.error('Error reporting backup:', err);
      reject(err);
    });
    
    req.write(body);
    req.end();
  });
}

/**
 * Backup a single project
 * 
 * Process:
 * 1. Fetch list of databases from MyTick API
 * 2. For each database:
 *    a. Retrieve secrets from Bitwarden
 *    b. Execute backup (mongodump, pg_dump, etc.)
 *    c. Upload to S3 Glacier
 *    d. Report result to MyTick API immediately (per-database reporting)
 * 3. Return summary for Lambda logs
 * 
 * Note: Each database reports independently to MyTick for real-time tracking
 * and Lambda timeout protection. See reportBackupResult() docs for rationale.
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
    const startedAt = new Date();
    let backupResult;
    let error = null;

    try {
      // Get connection string from Bitwarden
      const bitwardenRef = db.secretRefs?.find(ref => ref.provider === 'bitwarden');
      if (!bitwardenRef) {
        console.warn(`No Bitwarden secret ref for ${db.name}, skipping`);
        continue;
      }

      const connectionString = await getBitwardenSecret(bitwardenRef.itemId, bitwardenRef.field);
      
      // Backup based on database type
      switch (db.type) {
        case 'mongodb':
          backupResult = await backupMongoDB(db.name, connectionString, project.name);
          break;
        default:
          console.warn(`Unsupported database type: ${db.type}`);
          continue;
      }

      const completedAt = new Date();

      // Report success to MyTick API
      await reportBackupResult(project, db.id, {
        status: 'success',
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        sizeBytes: backupResult.size,
        s3Path: backupResult.s3Path,
        s3Bucket: process.env.AWS_S3_BUCKET || 'unknown',
        metadata: backupResult.metadata || {},
        triggeredBy: 'scheduled',
        lambdaRequestId: process.env.AWS_REQUEST_ID,
      });

      results.databases.push({
        name: db.name,
        type: db.type,
        size: backupResult.size,
        path: backupResult.s3Path
      });
      
      results.totalSize += backupResult.size;
      
      console.log(`Successfully backed up ${db.name} (${backupResult.size} bytes)`);
      
    } catch (err) {
      error = err;
      const completedAt = new Date();
      
      console.error(`Failed to backup ${db.name}:`, err);
      
      // Report failure to MyTick API
      try {
        await reportBackupResult(project, db.id, {
          status: 'failed',
          startedAt: startedAt.toISOString(),
          completedAt: completedAt.toISOString(),
          sizeBytes: 0,
          s3Path: '',
          s3Bucket: process.env.AWS_S3_BUCKET || 'unknown',
          errorMessage: err.message,
          metadata: {},
          triggeredBy: 'scheduled',
          lambdaRequestId: process.env.AWS_REQUEST_ID,
        });
      } catch (reportErr) {
        console.error('Failed to report backup failure:', reportErr);
      }
      
      results.databases.push({
        name: db.name,
        error: err.message
      });
    }
  }

  return results;
}

module.exports = { backupProject, fetchDatabases };
