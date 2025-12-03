import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { listFolders } from '@/lib/google-drive';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const parentId = searchParams.get('parentId') || undefined;

    const folders = await listFolders(session.user.id, parentId);

    return NextResponse.json({ folders });
  } catch (error) {
    console.error('Error listing folders:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list folders' },
      { status: 500 }
    );
  }
}
