"use server";

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

interface SearchResult {
  id: string;
  photographer: string;
  metadata: Record<string, unknown>;
  capturedAt: string;
  similarity: number;
  matchCount: number;
  url: string;
}

interface SearchResponse {
  results: SearchResult[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    totalFetched: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

const apiKey = process.env.API_KEY as string;
const backendUrl = process.env.BACKEND_URL as string;

// S3 Configuration
const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID as string;
const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY as string;
const awsRegion = process.env.AWS_REGION as string;
const s3Bucket = process.env.AWS_S3_BUCKET as string;
const s3TempFolder = process.env.AWS_S3_TEMP_FOLDER || "temp-uploads";

if (!apiKey) {
  throw new Error("API_KEY is not configured");
}

if (!backendUrl) {
  throw new Error("BACKEND_URL is not configured");
}

// Initialize S3 client
let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!awsAccessKeyId || !awsSecretAccessKey || !awsRegion || !s3Bucket) {
    throw new Error(
      "AWS S3 configuration is incomplete. Please set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, and AWS_S3_BUCKET"
    );
  }

  if (!s3Client) {
    s3Client = new S3Client({
      region: awsRegion,
      credentials: {
        accessKeyId: awsAccessKeyId,
        secretAccessKey: awsSecretAccessKey,
      },
    });
  }

  return s3Client;
}

export async function searchPhotos(
  imageBase64: string,
  page: number = 1,
  limit: number = 20
): Promise<SearchResponse> {
  try {
    // Convert base64 to blob
    const base64Data = imageBase64.split(",")[1];
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: "image/jpeg" });

    // Create FormData
    const formData = new FormData();
    formData.append("photo", blob, "photo.jpg");
    formData.append("page", page.toString());
    formData.append("limit", limit.toString());

    const response = await fetch(`${backendUrl}/api/search/photo`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const errorMessage =
        errorData?.error || `API request failed with status ${response.status}`;
      throw new Error(errorMessage);
    }

    const data: SearchResponse = await response.json();
    return data;
  } catch (error) {
    console.error("Error searching photos:", error);
    throw error;
  }
}

export async function getImageById(imageId: string): Promise<Uint8Array> {
  try {
    // First, get the presigned URL from the backend
    const response = await fetch(`${backendUrl}/api/image/${imageId}`, {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    const data = await response.json();
    const presignedUrl = data.url;

    // Then, fetch the actual image from the presigned URL
    const imageResponse = await fetch(presignedUrl);

    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image from S3: ${imageResponse.status}`);
    }

    // Convert to array buffer and then to Uint8Array for transfer
    const arrayBuffer = await imageResponse.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch (error) {
    console.error("Error fetching image:", error);
    throw error;
  }
}

import config from "@/config/site-config.json";

export async function shareImage(
  imageId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Fetch the image
    const imageBlob = await getImageById(imageId);

    // Convert blob to File object
    const buffer = Buffer.from(imageBlob);
    const file = new File([buffer], `photo-${imageId}.jpg`, {
      type: "image/jpeg",
    });

    // Check if Web Share API is available
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({
        files: [file],
        title: config.hooks.shareTitle,
        text: config.hooks.shareText,
      });
      return { success: true };
    } else {
      return { success: false, error: "Sharing not supported on this device" };
    }
  } catch (error) {
    console.error("Error sharing image:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to share image",
    };
  }
}

export async function getPresignedUrl(
  photoId: string
): Promise<{ url: string; expiresIn: number }> {
  try {
    const response = await fetch(`${backendUrl}/api/image/${photoId}`, {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get presigned URL: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error getting presigned URL:", error);
    throw error;
  }
}

export async function downloadPhoto(photoUrl: string): Promise<Blob> {
  try {
    const response = await fetch(photoUrl);

    if (!response.ok) {
      throw new Error(`Failed to download photo: ${response.status}`);
    }

    const blob = await response.blob();
    return blob;
  } catch (error) {
    console.error("Error downloading photo:", error);
    throw error;
  }
}

// ========== S3 Upload Functions ==========

export async function generatePresignedUploadUrl(): Promise<{
  uploadUrl: string;
  key: string;
}> {
  try {
    const client = getS3Client();

    // Generate unique key for the upload
    const key = `${s3TempFolder}/${randomUUID()}.jpg`;

    // Create presigned PUT URL
    const command = new PutObjectCommand({
      Bucket: s3Bucket,
      Key: key,
      ContentType: "image/jpeg",
    });

    // URL expires in 5 minutes
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 });

    return { uploadUrl, key };
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    throw error;
  }
}

export async function uploadImageToS3(
  formData: FormData
): Promise<{ key: string }> {
  try {
    const file = formData.get("file") as File;
    if (!file) {
      throw new Error("No file provided");
    }

    const client = getS3Client();
    const key = `${s3TempFolder}/${randomUUID()}.jpg`;

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    const command = new PutObjectCommand({
      Bucket: s3Bucket,
      Key: key,
      Body: buffer,
      ContentType: file.type || "image/jpeg",
    });

    await client.send(command);

    return { key };
  } catch (error) {
    console.error("Error uploading image to S3:", error);
    throw error;
  }
}

export async function searchPhotosByS3Key(
  s3Key: string,
  page: number = 1,
  limit: number = 20,
  date?: string
): Promise<SearchResponse | { error: string }> {
  const client = getS3Client();

  try {
    // Step 1: Generate presigned URL for the image in S3
    console.log(`Generating presigned URL for S3 image: ${s3Key}`);
    const getCommand = new GetObjectCommand({
      Bucket: s3Bucket,
      Key: s3Key,
    });

    // Generate presigned URL that expires in 5 minutes
    const presignedUrl = await getSignedUrl(client, getCommand, {
      expiresIn: 300 * 2 * 6,
    });

    // Step 2: Send presigned URL to backend for search
    console.log(`Sending presigned URL to backend for search`);
    const requestBody: {
      page: number;
      limit: number;
      image_url: string;
      date?: string;
    } = {
      page: page,
      limit: limit,
      image_url: presignedUrl,
    };

    // Only add date field if it's provided (ISO format: YYYY-MM-DD)
    if (date) {
      requestBody.date = date;
    }

    const searchResponse = await fetch(`${backendUrl}/api/search`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!searchResponse.ok) {
      const errorData = await searchResponse.json().catch(() => null);
      console.log("searchResponse", errorData);
      const errorMessage =
        errorData?.error ||
        `API request failed with status ${searchResponse.status}`;

      // Clean up temp image immediately on error
      try {
        const deleteCommand = new DeleteObjectCommand({
          Bucket: s3Bucket,
          Key: s3Key,
        });
        await client.send(deleteCommand);
        console.log(`Cleaned up temp image after error`);
      } catch (deleteError) {
        console.error("Error cleaning up temp image:", deleteError);
      }

      return { error: errorMessage };
    }

    const data: SearchResponse = await searchResponse.json();

    return data;
  } catch (error) {
    console.error("Error searching photos by S3 key:", error);

    // Try to cleanup even if search failed
    try {
      const deleteCommand = new DeleteObjectCommand({
        Bucket: s3Bucket,
        Key: s3Key,
      });
      await client.send(deleteCommand);
      console.log(`Cleaned up temp image after error`);
    } catch (deleteError) {
      console.error("Error cleaning up temp image:", deleteError);
    }

    throw error;
  }
}
