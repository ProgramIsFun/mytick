const AWS = require('aws-sdk');
const fs = require('fs');

// Configure Wasabi S3
const s3 = new AWS.S3({
  endpoint: process.env.WASABI_ENDPOINT || 'https://s3.us-east-1.wasabisys.com',
  accessKeyId: process.env.WASABI_ACCESS_KEY,
  secretAccessKey: process.env.WASABI_SECRET_KEY,
  region: process.env.WASABI_REGION || 'us-east-1',
  s3ForcePathStyle: true
});

/**
 * Upload file to Wasabi S3
 * @param {string} filePath - Local file path to upload
 * @param {string} s3Key - S3 object key (path in bucket)
 */
async function uploadToWasabi(filePath, s3Key) {
  const bucket = process.env.WASABI_BUCKET || 'nexus-backups';
  
  console.log(`Uploading ${filePath} to s3://${bucket}/${s3Key}`);

  const fileContent = fs.createReadStream(filePath);
  
  const params = {
    Bucket: bucket,
    Key: s3Key,
    Body: fileContent,
    StorageClass: 'STANDARD'
  };

  try {
    const result = await s3.upload(params).promise();
    console.log(`Upload successful: ${result.Location}`);
    return result;
  } catch (error) {
    console.error(`Upload failed:`, error);
    throw error;
  }
}

/**
 * List backups in Wasabi
 */
async function listBackups(projectName, dbName) {
  const bucket = process.env.WASABI_BUCKET || 'nexus-backups';
  const prefix = `${projectName}/mongodb/${dbName}/`;

  const params = {
    Bucket: bucket,
    Prefix: prefix
  };

  try {
    const data = await s3.listObjectsV2(params).promise();
    return data.Contents || [];
  } catch (error) {
    console.error(`List failed:`, error);
    throw error;
  }
}

module.exports = { uploadToWasabi, listBackups };
