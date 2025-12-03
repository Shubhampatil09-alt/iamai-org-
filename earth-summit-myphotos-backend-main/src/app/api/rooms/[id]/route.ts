import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET single room
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const room = await prisma.room.findUnique({
      where: { id },
      include: {
        _count: {
          select: { photos: true },
        },
      },
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    return NextResponse.json(room);
  } catch (error) {
    console.error("Get room error:", error);
    return NextResponse.json(
      { error: "Failed to fetch room" },
      { status: 500 }
    );
  }
}

// PATCH update room (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const { name } = await request.json();

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Room name is required" },
        { status: 400 }
      );
    }

    const room = await prisma.room.update({
      where: { id },
      data: {
        name: name.trim(),
      },
    });

    return NextResponse.json(room);
  } catch (error: any) {
    console.error("Update room error:", error);

    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "A room with this name already exists" },
        { status: 409 }
      );
    }

    if (error.code === "P2025") {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to update room" },
      { status: 500 }
    );
  }
}

// DELETE room (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;

    await prisma.room.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete room error:", error);

    if (error.code === "P2025") {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to delete room" },
      { status: 500 }
    );
  }
}
