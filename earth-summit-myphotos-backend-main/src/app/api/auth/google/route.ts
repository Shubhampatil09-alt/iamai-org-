import { NextRequest, NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/google-drive';
import { auth } from '@/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authUrl = getAuthUrl();
    return NextResponse.json({ url: authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    return NextResponse.json({ error: 'Failed to generate auth URL' }, { status: 500 });
  }
}
