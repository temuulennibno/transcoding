import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import fs from 'fs';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

// Configure R2 client (S3-compatible)
export function createR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;

  return new S3Client({
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
    region: 'auto',
  });
}

export async function downloadFromR2(r2Client, bucket, key, localPath) {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  const response = await r2Client.send(command);
  const fileStream = fs.createWriteStream(localPath);

  // Convert web stream to Node.js stream if needed
  const stream = response.Body instanceof Readable
    ? response.Body
    : Readable.from(response.Body);

  await pipeline(stream, fileStream);
}

export async function uploadToR2(r2Client, bucket, key, filePath, contentType) {
  const fileContent = fs.readFileSync(filePath);

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: fileContent,
    ContentType: contentType,
  });

  return r2Client.send(command);
}

export async function listR2Objects(r2Client, bucket, prefix) {
  const command = new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: prefix,
  });

  return r2Client.send(command);
}
