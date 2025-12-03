import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getKeyFromUrl, getPresignedUrl } from '@/lib/s3-storage';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ photoId: string }> }
) {
  try {
    // Check API key authentication
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { photoId } = await params;

    // Fetch photo from database to get the S3 key
    const photo = await prisma.photo.findUnique({
      where: { id: photoId },
    });

    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    // Extract S3 key from the URL stored in database
    const key = getKeyFromUrl(photo.azureUrl);

    // Generate a presigned URL with 5 minutes expiry (300 seconds)
    const presignedUrl = await getPresignedUrl(key, 300);

    return NextResponse.json({
      url: presignedUrl,
      expiresIn: 300
    });
  } catch (error) {
    console.error('Image proxy error:', error);
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 500 });
  }
}
