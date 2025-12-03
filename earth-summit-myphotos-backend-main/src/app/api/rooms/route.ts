import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

// GET all rooms
export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rooms = await prisma.room.findMany({
      orderBy: {
        name: 'asc',
      },
      include: {
        _count: {
          select: { photos: true },
        },
      },
    });

    return NextResponse.json(rooms);
  } catch (error) {
    console.error('Get rooms error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rooms' },
      { status: 500 }
    );
  }
}

// POST create new room (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { name } = await request.json();

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Room name is required' },
        { status: 400 }
      );
    }

    const room = await prisma.room.create({
      data: {
        name: name.trim(),
      },
    });

    return NextResponse.json(room, { status: 201 });
  } catch (error: any) {
    console.error('Create room error:', error);

    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A room with this name already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create room' },
      { status: 500 }
    );
  }
}
