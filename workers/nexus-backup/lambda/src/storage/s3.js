const { S3 } = require('aws-sdk');
const fs = require('fs');

const s3 = new S3();

async function uploadToS3(filePath, s3Key) {
  const bucket = process.env.AWS_S3_BUCKET;
  if (!bucket) throw new Error('AWS_S3_BUCKET environment variable required');

  console.log(`Uploading ${filePath} to s3://${bucket}/${s3Key}`);

  try {
    const result = await s3.upload({
      Bucket: bucket,
      Key: s3Key,
      Body: fs.createReadStream(filePath),
    }).promise();
    console.log(`Upload successful: ${result.Location}`);
    return result;
  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
}

async function listBackups(projectName, dbName) {
  const bucket = process.env.AWS_S3_BUCKET;
  if (!bucket) throw new Error('AWS_S3_BUCKET environment variable required');

  try {
    const data = await s3.listObjectsV2({
      Bucket: bucket,
      Prefix: `${projectName}-${dbName}-`,
    }).promise();
    return data.Contents || [];
  } catch (error) {
    console.error('List failed:', error);
    throw error;
  }
}

module.exports = { uploadToS3, listBackups };
