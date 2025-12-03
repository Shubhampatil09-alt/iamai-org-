import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getKeyFromUrl, getPresignedUrl } from "@/lib/s3-storage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Check API key authentication
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Photo ID is required" },
        { status: 400 },
      );
    }

    // Fetch photo from database
    const photo = await prisma.photo.findUnique({
      where: { id },
      select: {
        id: true,
        azureUrl: true,
        photographer: true,
        metadata: true,
        capturedAt: true,
      },
    });

    if (!photo) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    // Generate presigned URL
    const key = getKeyFromUrl(photo.azureUrl);
    const presignedUrl = await getPresignedUrl(key);

    return NextResponse.json({
      id: photo.id,
      presignedUrl,
      photographer: photo.photographer,
      metadata: photo.metadata,
      capturedAt: photo.capturedAt,
    });
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    return NextResponse.json(
      { error: "Failed to generate presigned URL" },
      { status: 500 },
    );
  }
}
