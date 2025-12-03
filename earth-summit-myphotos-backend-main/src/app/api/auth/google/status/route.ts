import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ connected: false });
    }

    const googleAuth = await prisma.googleDriveAuth.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    return NextResponse.json({ connected: !!googleAuth });
  } catch (error) {
    console.error('Error checking Google Drive status:', error);
    return NextResponse.json({ connected: false });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete the Google Drive auth record
    await prisma.googleDriveAuth.delete({
      where: { userId: session.user.id },
    });

    return NextResponse.json({
      success: true,
      message: 'Google Drive disconnected successfully'
    });
  } catch (error) {
    console.error('Error disconnecting Google Drive:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Google Drive' },
      { status: 500 }
    );
  }
}
