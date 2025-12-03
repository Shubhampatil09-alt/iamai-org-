import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decrypt, encrypt } from '@/lib/encryption';
import { getOAuth2Client } from '@/lib/google-drive';

// This endpoint is called by Lambda to get Google Drive access token
export async function GET(request: NextRequest) {
  try {
    // Verify internal API key for security
    const apiKey = request.headers.get('x-api-key');
    if (apiKey !== process.env.API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const auth = await prisma.googleDriveAuth.findUnique({
      where: { userId },
    });

    if (!auth) {
      return NextResponse.json({ error: 'Google Drive not connected' }, { status: 404 });
    }

    // Check if token expired and refresh if needed
    const now = new Date();
    let accessToken = decrypt(auth.accessToken);

    if (auth.expiresAt < now) {
      const oauth2Client = getOAuth2Client();
      oauth2Client.setCredentials({
        refresh_token: decrypt(auth.refreshToken),
      });

      const { credentials } = await oauth2Client.refreshAccessToken();

      // Update stored tokens
      await prisma.googleDriveAuth.update({
        where: { userId },
        data: {
          accessToken: encrypt(credentials.access_token!),
          expiresAt: new Date(credentials.expiry_date!),
        },
      });

      accessToken = credentials.access_token!;
    }

    return NextResponse.json({ accessToken });
  } catch (error) {
    console.error('Get GDrive token error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
