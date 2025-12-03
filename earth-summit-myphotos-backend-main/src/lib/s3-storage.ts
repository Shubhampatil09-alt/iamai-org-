import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

function getS3Client() {
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error('AWS credentials are not defined');
  }

  if (!process.env.AWS_REGION) {
    throw new Error('AWS_REGION is not defined');
  }

  return new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
}

function sanitizePhotographerName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/[^a-zA-Z0-9_-]/g, '') // Remove special characters except underscore and hyphen
    .toLowerCase();
}

function sanitizeFilename(filename: string): string {
  // Extract extension
  const lastDotIndex = filename.lastIndexOf('.');
  const name = lastDotIndex > 0 ? filename.substring(0, lastDotIndex) : filename;
  const ext = lastDotIndex > 0 ? filename.substring(lastDotIndex) : '';

  // Sanitize the name part
  const sanitizedName = name
    .trim()
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/[^a-zA-Z0-9_-]/g, '') // Remove special characters except underscore and hyphen
    .toLowerCase()
    .substring(0, 100); // Limit length to 100 chars

  // Sanitize extension (keep only alphanumeric)
  const sanitizedExt = ext.replace(/[^a-zA-Z0-9.]/g, '').toLowerCase();

  return sanitizedName + sanitizedExt;
}

async function addWatermark(imageBuffer: Buffer): Promise<Buffer> {
  // Get the logo path
  const logoPath = path.join(process.cwd(), 'public', 'gff_logo_white.png');

  // Check if logo exists
  if (!fs.existsSync(logoPath)) {
    console.warn('Logo file not found, uploading image without watermark');
    return imageBuffer;
  }

  try {
    // Get image metadata to calculate position
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error('Unable to read image dimensions');
    }

    // Read logo at original size
    const logoBuffer = await sharp(logoPath).toBuffer();

    // Get logo dimensions
    const logoMetadata = await sharp(logoBuffer).metadata();
    const logoWidth = logoMetadata.width || 0;
    const logoHeight = logoMetadata.height || 0;

    // Calculate position for top right corner with padding
    const padding = Math.floor(metadata.width * 0.02); // 2% padding
    const left = metadata.width - logoWidth - padding;
    const top = padding;

    // Composite the logo onto the image
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
    // Return original image if watermarking fails
    return imageBuffer;
  }
}

export async function uploadToS3(
  file: File,
  photographer?: string | null
): Promise<string> {
  const s3Client = getS3Client();

  if (!process.env.AWS_S3_BUCKET) {
    throw new Error('AWS_S3_BUCKET is not defined');
  }

  // Generate random ID to avoid conflicts
  const randomId = randomUUID();

  // Sanitize filename
  const sanitizedFilename = sanitizeFilename(file.name);

  // Build S3 key: photographer_folder/randomId-filename or just randomId-filename
  let key: string;
  if (photographer) {
    const sanitizedPhotographer = sanitizePhotographerName(photographer);
    key = `${sanitizedPhotographer}/${randomId}-${sanitizedFilename}`;
  } else {
    key = `${randomId}-${sanitizedFilename}`;
  }

  const arrayBuffer = await file.arrayBuffer();
  const originalBuffer = Buffer.from(new Uint8Array(arrayBuffer));

  // Add watermark to the image
  const buffer = await addWatermark(originalBuffer);

  await s3Client.send(
    new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: file.type,
    })
  );

  // Return the S3 URL
  return `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}

export async function deleteFromS3(key: string): Promise<void> {
  const s3Client = getS3Client();

  if (!process.env.AWS_S3_BUCKET) {
    throw new Error('AWS_S3_BUCKET is not defined');
  }

  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
    })
  );
}

export function getKeyFromUrl(url: string): string {
  const urlObj = new URL(url);
  // Remove leading slash from pathname
  return urlObj.pathname.substring(1);
}

export async function getPresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
  try {
    const s3Client = getS3Client();

    if (!process.env.AWS_S3_BUCKET) {
      throw new Error('AWS_S3_BUCKET is not defined');
    }

    if (!key || key.trim() === '') {
      throw new Error('S3 key is empty or invalid');
    }

    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
    });

    // Generate presigned URL that expires in 1 hour by default
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn });

    return presignedUrl;
  } catch (error) {
    console.error(`Error generating presigned URL for key "${key}":`, error);
    throw error;
  }
}