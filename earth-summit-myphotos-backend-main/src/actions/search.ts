'use server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { uploadToS3, getKeyFromUrl, getPresignedUrl } from '@/lib/s3-storage';
import { generateFaceEmbeddings, NoFacesDetectedError } from '@/lib/embeddings';

export type SearchResult = {
  id: string;
  photographer: string | null;
  metadata: any;
  capturedAt: Date | null;
  similarity: number;
  matchCount: number;
  url: string;
};

export type SearchResponse = {
  success: boolean;
  results?: SearchResult[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  error?: string;
};

export async function searchPhotosByFace(
  formData: FormData
): Promise<SearchResponse> {
  try {
    // Check authentication
    const session = await auth();
    if (!session) {
      return { success: false, error: 'Unauthorized' };
    }

    const file = formData.get('file') as File;
    const page = parseInt(formData.get('page') as string) || 1;
    const limit = Math.min(parseInt(formData.get('limit') as string) || 50, 100);

    if (!file) {
      return { success: false, error: 'No file provided' };
    }

    if (page < 1 || limit < 1) {
      return { success: false, error: 'Invalid pagination parameters' };
    }

    // Get distance threshold from env (default 0.2)
    const distanceThreshold = parseFloat(process.env.FACE_DISTANCE_THRESHOLD || '0.2');

    // Upload search image to S3 in /search folder
    const searchImageUrl = await uploadToS3(file, 'search');

    // Generate face embeddings from the uploaded search image
    let queryFaces;
    try {
      queryFaces = await generateFaceEmbeddings(file);
    } catch (error) {
      // Check if no faces were detected
      if (error instanceof NoFacesDetectedError) {
        return { success: false, error: 'No faces detected in the uploaded image' };
      }
      throw error;
    }

    // Find similar faces for each query face and aggregate results
    const allResults = new Map<
      string,
      {
        id: string;
        s3Url: string;
        photographer: string | null;
        metadata: any;
        capturedAt: Date | null;
        bestDistance: number;
        matchCount: number;
      }
    >();

    console.log(`Using distance threshold: ${distanceThreshold}`);
    console.log(`Searching with ${queryFaces.length} detected face(s)`);

    for (const queryFace of queryFaces) {
      const embeddingString = `[${queryFace.embedding.join(",")}]`;

      // Get filtered results within threshold
      const faceResults = await prisma.$queryRaw<
        Array<{
          id: string;
          s3Url: string;
          photographer: string | null;
          metadata: any;
          capturedAt: Date | null;
          distance: number;
        }>
      >`
        SELECT
          p.id,
          p."azureUrl" as "s3Url",
          p.photographer,
          p.metadata,
          p."capturedAt",
          fe.embedding <=> ${embeddingString}::vector as distance
        FROM photos p
        JOIN face_embeddings fe ON fe."photoId" = p.id
        WHERE fe.embedding <=> ${embeddingString}::vector <= ${distanceThreshold}
        ORDER BY fe.embedding <=> ${embeddingString}::vector
      `;

      console.log(`Found ${faceResults.length} results within threshold for this face`);

      // Aggregate results by photo ID
      for (const result of faceResults) {
        const existing = allResults.get(result.id);
        if (!existing || result.distance < existing.bestDistance) {
          allResults.set(result.id, {
            id: result.id,
            s3Url: result.s3Url,
            photographer: result.photographer,
            metadata: result.metadata,
            capturedAt: result.capturedAt,
            bestDistance: result.distance,
            matchCount: existing ? existing.matchCount + 1 : 1,
          });
        } else if (existing) {
          existing.matchCount += 1;
        }
      }
    }

    // Convert to array and sort by best distance and match count
    const allSortedResults = Array.from(allResults.values()).sort((a, b) => {
      // Prioritize photos with more face matches, then by distance
      if (a.matchCount !== b.matchCount) {
        return b.matchCount - a.matchCount;
      }
      return a.bestDistance - b.bestDistance;
    });

    console.log(`\nFinal aggregated results: ${allSortedResults.length} unique photos`);

    // Pagination
    const total = allSortedResults.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedResults = allSortedResults.slice(startIndex, endIndex);

    // Generate presigned URLs for all results
    const presignedUrls = await Promise.all(
      paginatedResults.map(async (result) => {
        const key = getKeyFromUrl(result.s3Url);
        return await getPresignedUrl(key);
      }),
    );

    // Convert cosine distance to similarity score (lower distance = higher similarity)
    const formattedResults: SearchResult[] = paginatedResults
      .map((result, index) => ({
        id: result.id,
        photographer: result.photographer,
        metadata: result.metadata,
        capturedAt: result.capturedAt,
        similarity: Math.max(0, 1 - Number(result.bestDistance)),
        matchCount: result.matchCount,
        url: presignedUrls[index],
      }))
      .sort((a, b) => b.similarity - a.similarity); // Sort by similarity descending

    return {
      success: true,
      results: formattedResults,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  } catch (error) {
    console.error('Search error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Search failed',
    };
  }
}