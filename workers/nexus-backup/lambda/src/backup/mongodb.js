const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const { uploadToS3 } = require('../storage/s3');

const execAsync = promisify(exec);

/**
 * Backup MongoDB database using mongodump
 */
async function backupMongoDB(dbName, connectionString, projectName, dbId) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeName = `${projectName}-${dbName}`.replace(/\s+/g, '_');
  const backupDir = `/tmp/${safeName}-${timestamp}`;
  const archivePath = `${backupDir}.tar.gz`;

  try {
    console.log(`Creating MongoDB backup for ${dbName}...`);
    await execAsync(`mongodump --uri="${connectionString}" --out="${backupDir}"`);

    await execAsync(`tar -czf "${archivePath}" -C /tmp "${path.basename(backupDir)}"`);

    // Get file size
    const stats = await fs.stat(archivePath);

    const s3Path = `${dbId}-${timestamp}.tar.gz`;
    await uploadToS3(archivePath, s3Path);

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
