import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateFaceEmbeddings, NoFacesDetectedError } from "@/lib/embeddings";
import { getKeyFromUrl, getPresignedUrl } from "@/lib/s3-storage";

export async function POST(request: NextRequest) {
  try {
    // Check API key authentication
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // const apiKey = "123";
    // if (!apiKey || apiKey !== process.env.API_KEY) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }

    // Get distance threshold from env (default 0.3)
    const distanceThreshold = parseFloat(process.env.FACE_DISTANCE_THRESHOLD || '0.6');

    const body = await request.json();
    const { image_url, page = 1, limit = 20, date } = body;

    if (!image_url) {
      return NextResponse.json(
        { error: "No image_url provided" },
        { status: 400 },
      );
    }

    if (page < 1 || limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: "Invalid pagination parameters" },
        { status: 400 },
      );
    }

    // Download image from presigned URL
    let imageBlob: Blob;
    try {
      const imageResponse = await fetch(image_url);
      if (!imageResponse.ok) {
        return NextResponse.json(
          {
            error: `Failed to download image from URL: ${imageResponse.status} ${imageResponse.statusText}`,
          },
          { status: 400 },
        );
      }
      imageBlob = await imageResponse.blob();
    } catch (error) {
      return NextResponse.json(
        { error: "Failed to download image from provided URL" },
        { status: 400 },
      );
    }

    // Convert blob to File object
    const file = new File([imageBlob], "search-image.jpg", {
      type: imageBlob.type,
    });

    // Generate embeddings for all faces in search query
    let queryFaces;
    try {
      queryFaces = await generateFaceEmbeddings(file);
    } catch (error) {
      // Check if no faces were detected
      if (error instanceof NoFacesDetectedError) {
        return NextResponse.json(
          { error: "No faces detected" },
          { status: 404 },
        );
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

    for (const queryFace of queryFaces) {
      const embeddingString = `[${queryFace.embedding.join(",")}]`;

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

    // Filter by date if provided
    const filteredResults = date
      ? allSortedResults.filter((result) => {
          const dateKey = result.capturedAt?.toISOString().split('T')[0] || 'unknown';
          return dateKey === date;
        })
      : allSortedResults;

    console.log(`Total results: ${filteredResults.length} ${date ? `(filtered for ${date})` : ''}`);

    // Simple pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedResults = filteredResults.slice(startIndex, endIndex);

    console.log(`Page ${page}, returning ${paginatedResults.length} results (${startIndex} to ${endIndex})`);

    const total = filteredResults.length;
    const totalPages = Math.ceil(total / limit);

    // Generate presigned URLs for all results
    const presignedUrls = await Promise.all(
      paginatedResults.map(async (result) => {
        const key = getKeyFromUrl(result.s3Url);
        return await getPresignedUrl(key);
      }),
    );

    // Convert cosine distance to similarity score (lower distance = higher similarity)
    // Cosine distance ranges from 0 (identical) to 1 (opposite)
    const formattedResults = paginatedResults.map((result, index) => ({
      id: result.id,
      photographer: result.photographer,
      metadata: result.metadata,
      capturedAt: result.capturedAt,
      similarity: Math.max(0, 1 - Number(result.bestDistance)), // Convert cosine distance to 0-1 similarity
      matchCount: result.matchCount,
      url: presignedUrls[index],
    }));

    return NextResponse.json({
      results: formattedResults,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
