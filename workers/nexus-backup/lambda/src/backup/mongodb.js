const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const { uploadToWasabi } = require('../storage/wasabi');

const execAsync = promisify(exec);

/**
 * Backup MongoDB database using mongodump
 */
async function backupMongoDB(dbName, connectionString, projectName) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = `/tmp/${projectName}-${dbName}-${timestamp}`;
  const archivePath = `${backupDir}.tar.gz`;

  try {
    console.log(`Creating MongoDB backup for ${dbName}...`);
    await execAsync(`mongodump --uri="${connectionString}" --out="${backupDir}"`);

    // Compress backup
    await execAsync(`tar -czf ${archivePath} -C /tmp ${path.basename(backupDir)}`);

    // Get file size
    const stats = await fs.stat(archivePath);

    // Upload to Wasabi
    const s3Path = `${projectName}/mongodb/${dbName}/${timestamp}.tar.gz`;
    await uploadToWasabi(archivePath, s3Path);

    // Cleanup
    await fs.rm(backupDir, { recursive: true, force: true });
    await fs.unlink(archivePath);

    return {
      size: stats.size,
      s3Path
    };

  } catch (error) {
    console.error(`MongoDB backup failed for ${dbName}:`, error);
    // Cleanup on error
    try {
      await fs.rm(backupDir, { recursive: true, force: true });
      await fs.unlink(archivePath);
    } catch {}
    throw error;
  }
}

module.exports = { backupMongoDB };
