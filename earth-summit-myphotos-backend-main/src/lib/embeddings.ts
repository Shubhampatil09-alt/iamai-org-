import crypto from 'crypto';

export class NoFacesDetectedError extends Error {
  constructor() {
    super("No faces detected");
    this.name = "NoFacesDetectedError";
  }
}

type FaceEmbeddingResult = Array<{
  face_id: number;
  embedding: number[];
  bbox: number[];
  confidence: number;
}>;

function getCacheKey(imageUrl: string): string {
  // Extract the S3 path before query parameters (up to file extension)
  // Example: https://bucket.s3.region.amazonaws.com/path/file.jpg?params... -> /path/file.jpg
  const urlObj = new URL(imageUrl);
  const pathname = urlObj.pathname; // Gets "/path/file.jpg"

  // Hash the pathname only, ignoring presigned URL query params
  return `embedding:${crypto.createHash('sha256').update(pathname).digest('hex')}`;
}

export async function generateFaceEmbeddingsFromUrl(imageUrl: string): Promise<FaceEmbeddingResult> {
  const cacheKey = getCacheKey(imageUrl);

  // Try to get from cache first
  // const cached = await getCachedData<FaceEmbeddingResult>(cacheKey);
  // if (cached) {
  //   console.log('Embedding cache hit for URL');
  //   return cached;
  // }

  const embeddingServiceUrl =
    process.env.EMBEDDING_SERVICE_URL || "http://localhost:8000";

  console.log(`Cache miss - making request to ${embeddingServiceUrl}/extract-embedding-from-url`);

  try {
    const response = await fetch(`${embeddingServiceUrl}/extract-embedding-from-url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ image_url: imageUrl }),
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new NoFacesDetectedError();
      }
      const errorText = await response.text();
      console.error("Embedding service error:", response.status, errorText);
      try {
        const error = JSON.parse(errorText);
        throw new Error(error.detail || "Failed to extract embedding");
      } catch {
        throw new Error(`Failed to extract embedding: ${response.status} ${errorText}`);
      }
    }

    const data = await response.json();
    const faces = data.faces as FaceEmbeddingResult;

    // Cache the result for 5 minutes (300 seconds)
    // await setCachedData(cacheKey, faces, 300);

    return faces;
  } catch (error) {
    if (error instanceof NoFacesDetectedError) {
      throw error;
    }
    console.error("Error generating face embeddings:", error);
    throw error;
  }
}

export async function generateFaceEmbeddings(file: File): Promise<
  Array<{
    face_id: number;
    embedding: number[];
    bbox: number[];
    confidence: number;
  }>
> {
  const embeddingServiceUrl =
    process.env.EMBEDDING_SERVICE_URL || "http://localhost:8000";

  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch(`${embeddingServiceUrl}/extract-embedding`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new NoFacesDetectedError();
      }
      const errorText = await response.text();
      console.error("Embedding service error:", response.status, errorText);
      try {
        const error = JSON.parse(errorText);
        throw new Error(error.detail || "Failed to extract embedding");
      } catch {
        throw new Error(`Failed to extract embedding: ${response.status} ${errorText}`);
      }
    }

    const data = await response.json();
    return data.faces;
  } catch (error) {
    if (error instanceof NoFacesDetectedError) {
      throw error;
    }
    console.error("Error generating face embeddings:", error);
    throw error;
  }
}

// Legacy function for backward compatibility - returns first face embedding
export async function generateFaceEmbedding(file: File): Promise<number[]> {
  const faces = await generateFaceEmbeddings(file);
  if (faces.length === 0) {
    throw new Error("No faces detected");
  }
  return faces[0].embedding;
}
