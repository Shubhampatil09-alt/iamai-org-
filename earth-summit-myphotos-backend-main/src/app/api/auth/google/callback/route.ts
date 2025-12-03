import { NextRequest, NextResponse } from 'next/server';
import { getOAuth2Client } from '@/lib/google-drive';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/encryption';
import { auth } from '@/auth';

export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXTAUTH_URL || new URL(request.url).origin;
  try {
    const session = await auth();

    // Use NEXTAUTH_URL for redirects to ensure correct domain

    if (!session?.user?.id) {
      return NextResponse.redirect(new URL('/login', baseUrl));
    }

    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(
        new URL(`/dashboard?error=google_auth_failed`, baseUrl)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL(`/dashboard?error=missing_code`, baseUrl)
      );
    }

    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      return NextResponse.redirect(
        new URL(`/dashboard?error=invalid_tokens`, baseUrl)
      );
    }

    // Store or update tokens
    await prisma.googleDriveAuth.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token),
        expiresAt: new Date(tokens.expiry_date!),
        scope: tokens.scope!,
      },
      update: {
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token),
        expiresAt: new Date(tokens.expiry_date!),
        scope: tokens.scope!,
      },
    });

    return NextResponse.redirect(
      new URL('/dashboard?success=google_drive_connected', baseUrl)
    );
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(
      new URL('/dashboard?error=oauth_failed', baseUrl)
    );
  }
}
