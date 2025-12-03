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
    // Get distance threshold from env (default 0.2)
    const distanceThreshold = parseFloat(process.env.FACE_DISTANCE_THRESHOLD || '0.2');

    const formData = await request.formData();
    const imageFile = formData.get('photo') as File;
    const page = parseInt(formData.get('page') as string) || 1;
    const limit = parseInt(formData.get('limit') as string) || 20;

    if (!imageFile) {
      return NextResponse.json(
        { error: "No photo provided" },
        { status: 400 },
      );
    }

    if (page < 1 || limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: "Invalid pagination parameters" },
        { status: 400 },
      );
    }

    // Generate embeddings for all faces in search query
    let queryFaces;
    try {
      queryFaces = await generateFaceEmbeddings(imageFile);
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

    console.log(`Using distance threshold: ${distanceThreshold}`);
    console.log(`Searching with ${queryFaces.length} detected face(s)`);

    for (const queryFace of queryFaces) {
      const embeddingString = `[${queryFace.embedding.join(",")}]`;

      // Calculate total results needed based on pagination
      const totalNeeded = page * limit;

      // First, get all results without filtering to see the distribution
      const allFaceResults = await prisma.$queryRaw<
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
        ORDER BY fe.embedding <=> ${embeddingString}::vector
        LIMIT ${totalNeeded}
      `;

      console.log(`\nTop 20 results for query face (before threshold filter):`);
      allFaceResults.forEach((result, idx) => {
        const similarity = Math.max(0, 1 - Number(result.distance));
        console.log(`  ${idx + 1}. Photo ${result.id.substring(0, 8)}... - Distance: ${result.distance.toFixed(4)}, Similarity: ${(similarity * 100).toFixed(2)}%`);
      });

      const filteredCount = allFaceResults.filter(r => r.distance > distanceThreshold).length;
      console.log(`Filtered out ${filteredCount} results with distance > ${distanceThreshold}`);

      // Now get the actual filtered results
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

      console.log(`Returned ${faceResults.length} results within threshold`);

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
    if (allSortedResults.length > 0) {
      console.log(`Best match: Photo ${allSortedResults[0].id.substring(0, 8)}... - Distance: ${allSortedResults[0].bestDistance.toFixed(4)}, Matches: ${allSortedResults[0].matchCount}`);
    }

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
    // Cosine distance ranges from 0 (identical) to 1 (opposite)
    const formattedResults = paginatedResults.map((result, index) => ({
      id: result.id,
      photographer: result.photographer,
      metadata: result.metadata,
      capturedAt: result.capturedAt,
      similarity: Math.max(0, 1 - Number(result.bestDistance)), // Convert cosine distance to 0-1 similarity
      matchCount: result.matchCount,
      url: presignedUrls[index],
    })).sort((a, b) => b.similarity - a.similarity); // Sort by similarity descending

    return NextResponse.json({
      results: formattedResults,
      totalFetched: formattedResults.length,
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
