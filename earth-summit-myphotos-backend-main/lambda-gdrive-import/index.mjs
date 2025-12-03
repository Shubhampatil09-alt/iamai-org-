import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { google } from 'googleapis';
import sharp from 'sharp';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Environment variables
const API_BASE_URL = process.env.API_BASE_URL; // Your Next.js app URL
const API_KEY = process.env.API_KEY;
const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET;
const AWS_REGION = process.env.AWS_REGION;
const EMBEDDING_SERVICE_URL = process.env.EMBEDDING_SERVICE_URL;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

// Initialize S3 client
const s3Client = new S3Client({ region: AWS_REGION });

// Helper function to call Next.js API
async function callAPI(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API call failed: ${response.status} ${errorText}`);
  }

  return response.json();
}

// Get Google Drive access token from Next.js API
async function getGoogleDriveToken(userId) {
  const data = await callAPI(`/api/internal/get-gdrive-token?userId=${userId}`);
  return data.accessToken;
}

// Download file from Google Drive
async function downloadFileFromGDrive(userId, fileId) {
  const accessToken = await getGoogleDriveToken(userId);

  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({ access_token: accessToken });

  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  const response = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );

  return Buffer.from(response.data);
}

// S3 helper functions
function sanitizePhotographerName(name) {
  return name
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .toLowerCase();
}

function sanitizeFilename(filename) {
  const lastDotIndex = filename.lastIndexOf('.');
  const name = lastDotIndex > 0 ? filename.substring(0, lastDotIndex) : filename;
  const ext = lastDotIndex > 0 ? filename.substring(lastDotIndex) : '';

  const sanitizedName = name
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .toLowerCase()
    .substring(0, 100);

  const sanitizedExt = ext.replace(/[^a-zA-Z0-9.]/g, '').toLowerCase();

  return sanitizedName + sanitizedExt;
}

async function addWatermark(imageBuffer) {
  const logoPath = join(__dirname, 'logo.png');

  try {
    const logoBuffer = readFileSync(logoPath);

    const image = sharp(imageBuffer);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error('Unable to read image dimensions');
    }

    const logoMetadata = await sharp(logoBuffer).metadata();
    const logoWidth = logoMetadata.width || 0;
    const logoHeight = logoMetadata.height || 0;

    const padding = Math.floor(metadata.width * 0.02);
    const left = metadata.width - logoWidth - padding;
    const top = padding;

    const watermarkedBuffer = await image
      .composite([{
        input: logoBuffer,
        left,
        top,
      }])
      .toBuffer();

    return watermarkedBuffer;
  } catch (error) {
    console.error('Error adding watermark:', error);
    return imageBuffer;
  }
}

async function uploadToS3(buffer, filename, mimeType, photographer) {
  const randomId = randomUUID();
  const sanitizedFilename = sanitizeFilename(filename);

  let key;
  if (photographer) {
    const sanitizedPhotographer = sanitizePhotographerName(photographer);
    key = `${sanitizedPhotographer}/${randomId}-${sanitizedFilename}`;
  } else {
    key = `${randomId}-${sanitizedFilename}`;
  }

  const watermarkedBuffer = await addWatermark(buffer);

  await s3Client.send(
    new PutObjectCommand({
      Bucket: AWS_S3_BUCKET,
      Key: key,
      Body: watermarkedBuffer,
      ContentType: mimeType,
    })
  );

  return `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${key}`;
}

async function deleteFromS3(url) {
  const urlObj = new URL(url);
  const key = urlObj.pathname.substring(1);

  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: AWS_S3_BUCKET,
      Key: key,
    })
  );
}

function getKeyFromUrl(url) {
  const urlObj = new URL(url);
  return urlObj.pathname.substring(1);
}

async function getPresignedUrl(key, expiresIn = 3600) {
  const command = new GetObjectCommand({
    Bucket: AWS_S3_BUCKET,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

// Generate face embeddings
async function generateFaceEmbeddingsFromUrl(imageUrl) {
  const response = await fetch(`${EMBEDDING_SERVICE_URL}/extract-embedding-from-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ image_url: imageUrl }),
  });

  if (!response.ok) {
    if (response.status === 404) {
      return []; // No faces detected
    }
    const errorText = await response.text();
    throw new Error(`Embedding service error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.faces || [];
}

// Main processing function
async function processImportFile(message) {
  const { jobId, fileId, googleDriveFileId, fileName, mimeType, userId, roomId, capturedAt } = message;

  let azureUrl = null;

  try {
    console.log(`[Job ${jobId}][File ${fileId}] Starting processing: ${fileName}`);

    // Update file status to DOWNLOADING
    console.log(`[Job ${jobId}][File ${fileId}] Updating status to DOWNLOADING`);
    await callAPI('/api/internal/process-import-file', 'POST', {
      action: 'update_file_status',
      fileId,
      status: 'DOWNLOADING',
    });
    console.log(`[Job ${jobId}][File ${fileId}] Status updated to DOWNLOADING`);

    // Download file from Google Drive
    console.log(`[Job ${jobId}][File ${fileId}] Downloading from Google Drive...`);
    const fileBuffer = await downloadFileFromGDrive(userId, googleDriveFileId);
    console.log(`[Job ${jobId}][File ${fileId}] Downloaded ${fileBuffer.length} bytes`);

    // Update status to UPLOADING
    console.log(`[Job ${jobId}][File ${fileId}] Updating status to UPLOADING`);
    await callAPI('/api/internal/process-import-file', 'POST', {
      action: 'update_file_status',
      fileId,
      status: 'UPLOADING',
    });

    // Get user info for photographer name
    console.log(`[Job ${jobId}][File ${fileId}] Fetching user info...`);
    const userInfo = await callAPI(`/api/internal/get-user-info?userId=${userId}`);
    const photographerName = userInfo.email || 'Unknown';
    console.log(`[Job ${jobId}][File ${fileId}] Photographer: ${photographerName}`);

    // Upload to S3
    console.log(`[Job ${jobId}][File ${fileId}] Uploading to S3...`);
    azureUrl = await uploadToS3(fileBuffer, fileName, mimeType, photographerName);
    console.log(`[Job ${jobId}][File ${fileId}] Uploaded to S3: ${azureUrl}`);

    // Update status to PROCESSING_EMBEDDINGS
    console.log(`[Job ${jobId}][File ${fileId}] Updating status to PROCESSING_EMBEDDINGS`);
    await callAPI('/api/internal/process-import-file', 'POST', {
      action: 'update_file_status',
      fileId,
      status: 'PROCESSING_EMBEDDINGS',
    });

    // Generate presigned URL
    console.log(`[Job ${jobId}][File ${fileId}] Generating presigned URL...`);
    const key = getKeyFromUrl(azureUrl);
    const presignedUrl = await getPresignedUrl(key, 3600);

    // Generate face embeddings
    console.log(`[Job ${jobId}][File ${fileId}] Generating face embeddings...`);
    const faces = await generateFaceEmbeddingsFromUrl(presignedUrl);
    console.log(`[Job ${jobId}][File ${fileId}] Detected ${faces.length} faces`);

    // Save photo and update job via API
    console.log(`[Job ${jobId}][File ${fileId}] Saving photo to database...`);
    await callAPI('/api/internal/process-import-file', 'POST', {
      action: 'save_photo',
      fileId,
      jobId,
      userId,
      roomId,
      azureUrl,
      photographerName,
      fileName,
      capturedAt,
      faces,
    });

    console.log(`[Job ${jobId}][File ${fileId}] ✓ Successfully processed ${fileName}`);
    return { success: true };

  } catch (error) {
    console.error(`[Job ${jobId}][File ${fileId}] ❌ ERROR processing ${fileName}:`, error);
    console.error(`[Job ${jobId}][File ${fileId}] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');

    // Clean up S3 file if uploaded
    if (azureUrl) {
      try {
        console.log(`[Job ${jobId}][File ${fileId}] Cleaning up S3 file: ${azureUrl}`);
        await deleteFromS3(azureUrl);
        console.log(`[Job ${jobId}][File ${fileId}] S3 cleanup successful`);
      } catch (cleanupError) {
        console.error(`[Job ${jobId}][File ${fileId}] Failed to cleanup S3 file:`, cleanupError);
      }
    }

    // Increment retry count via API
    console.log(`[Job ${jobId}][File ${fileId}] Incrementing retry count...`);
    const result = await callAPI('/api/internal/process-import-file', 'POST', {
      action: 'increment_retry',
      fileId,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
    console.log(`[Job ${jobId}][File ${fileId}] Retry result - shouldRetry: ${result.shouldRetry}`);

    // Throw error if should retry (SQS will handle retry)
    if (result.shouldRetry) {
      console.log(`[Job ${jobId}][File ${fileId}] Throwing error for SQS retry`);
      throw error;
    }

    console.log(`[Job ${jobId}][File ${fileId}] Max retries reached, marking as failed`);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Lambda handler
export const handler = async (event) => {
  console.log('Lambda invoked with event:', JSON.stringify(event, null, 2));

  const results = [];

  for (const record of event.Records) {
    try {
      const message = JSON.parse(record.body);
      console.log('Processing message:', message);

      const result = await processImportFile(message);
      results.push(result);

    } catch (error) {
      console.error('Error processing record:', error);
      // Lambda will automatically return the message to SQS for retry
      // or move to DLQ after max retries
      throw error;
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Processing complete',
      results,
    }),
  };
};
