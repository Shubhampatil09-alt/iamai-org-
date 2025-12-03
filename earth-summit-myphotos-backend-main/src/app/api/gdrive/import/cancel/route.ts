import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
// import { deleteFromS3, getKeyFromUrl } from '@/lib/s3-storage'; // Uncomment when S3 deletion is approved
import { deleteFromS3, getKeyFromUrl } from '@/lib/s3-storage';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { jobId } = body;

    if (!jobId) {
      return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
    }

    // Get job with files that have photos
    const job = await prisma.importJob.findUnique({
      where: { id: jobId, userId: session.user.id },
      include: {
        files: {
          where: {
            photoId: { not: null },
          },
          select: {
            photoId: true,
          },
        },
      },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (job.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Job already cancelled' }, { status: 400 });
    }

    console.log(`[Job ${jobId}] Cancelling job - ${job.folderName}`);

    // Get photos to delete
    const photoIds = job.files.map(f => f.photoId!).filter(Boolean);

    if (photoIds.length > 0) {
      console.log(`[Job ${jobId}] Deleting ${photoIds.length} photos from database`);

      // NOTE: S3 deletion is commented out pending approval
      // Reason: Want to ensure no accidental data loss
      // Safety: Deletion is scoped to exact photo IDs from this job only
      // To enable: Uncomment the import at top and the code block below

      // SCENARIO 1: Delete already uploaded photos from S3
      // const photos = await prisma.photo.findMany({
      //   where: { id: { in: photoIds } },
      //   select: { id: true, azureUrl: true },
      // });
      // for (const photo of photos) {
      //   try {
      //     const key = getKeyFromUrl(photo.azureUrl);
      //     await deleteFromS3(key);
      //     console.log(`[Job ${jobId}] Deleted S3 file: ${key}`);
      //   } catch (error) {
      //     console.error(`[Job ${jobId}] Failed to delete S3 file ${photo.azureUrl}:`, error);
      //   }
      // }

      // Delete photos from database (face embeddings cascade automatically)
      await prisma.photo.deleteMany({
        where: { id: { in: photoIds } },
      });

      console.log(`[Job ${jobId}] Deleted ${photoIds.length} photos and embeddings from database`);
    }

    // Mark job as CANCELLED (keep the record for history)
    await prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: 'CANCELLED',
      },
    });

    console.log(`[Job ${jobId}] ❌ Job marked as CANCELLED`);

    return NextResponse.json({
      success: true,
      message: 'Job cancelled successfully',
      deletedPhotos: photoIds.length,
    });
  } catch (error) {
    console.error('Error cancelling job:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to cancel job' },
      { status: 500 }
    );
  }
}
