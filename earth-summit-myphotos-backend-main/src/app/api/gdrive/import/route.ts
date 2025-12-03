import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { listAllFilesInFolder } from '@/lib/google-drive';
import { sendBatchToQueue } from '@/lib/sqs-client';
import type { SQSImportMessage } from '@/types/google-drive';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'PHOTOGRAPHER' && session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Only photographers can import photos' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { folderId, folderName, roomId, capturedAt, includeSubfolders = true } = body;

    if (!folderId || !folderName || !roomId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify room exists
    const room = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      return NextResponse.json({ error: 'Invalid room' }, { status: 400 });
    }

    // Create import job
    const job = await prisma.importJob.create({
      data: {
        userId: session.user.id,
        roomId,
        folderId,
        folderName,
        status: 'DISCOVERING',
        capturedAt: capturedAt ? new Date(capturedAt) : null,
      },
    });

    // Discover files in background (don't await)
    discoverAndEnqueueFiles(job.id, session.user.id, folderId, roomId, capturedAt, includeSubfolders)
      .catch(error => {
        console.error('Error discovering files:', error);
        prisma.importJob.update({
          where: { id: job.id },
          data: {
            status: 'FAILED',
            errorMessage: error instanceof Error ? error.message : 'Failed to discover files',
          },
        }).catch(console.error);
      });

    return NextResponse.json({
      jobId: job.id,
      message: 'Import job started. You can safely close this page.'
    });
  } catch (error) {
    console.error('Error starting import:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start import' },
      { status: 500 }
    );
  }
}

async function discoverAndEnqueueFiles(
  jobId: string,
  userId: string,
  folderId: string,
  roomId: string,
  capturedAt: string | null,
  includeSubfolders: boolean
) {
  console.log(`[Import Job ${jobId}] Starting file discovery for folder ${folderId}`);

  // List all files
  const files = await listAllFilesInFolder(userId, folderId, includeSubfolders);
  console.log(`[Import Job ${jobId}] Found ${files.length} total files`);

  // Filter only image files and create job file records
  const imageFiles = files.filter(f =>
    f.mimeType && f.mimeType.startsWith('image/')
  );
  console.log(`[Import Job ${jobId}] Found ${imageFiles.length} image files`);

  if (imageFiles.length === 0) {
    console.log(`[Import Job ${jobId}] No images found, marking as completed`);
    await prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        totalFiles: 0,
      },
    });
    return;
  }

  // Create file records
  console.log(`[Import Job ${jobId}] Creating ${imageFiles.length} file records in database`);
  const fileRecords = await prisma.$transaction(
    imageFiles.map(file =>
      prisma.importJobFile.create({
        data: {
          jobId,
          fileId: file.id!,
          fileName: file.name!,
          mimeType: file.mimeType!,
          fileSize: parseInt(file.size || '0'),
          status: 'QUEUED',
        },
      })
    )
  );
  console.log(`[Import Job ${jobId}] Created ${fileRecords.length} file records`);

  // Update job with total files
  await prisma.importJob.update({
    where: { id: jobId },
    data: {
      status: 'QUEUED',
      totalFiles: imageFiles.length,
    },
  });
  console.log(`[Import Job ${jobId}] Updated job status to QUEUED`);

  // Enqueue files to SQS
  const messages: SQSImportMessage[] = fileRecords.map((record, idx) => ({
    jobId,
    fileId: record.id,
    googleDriveFileId: imageFiles[idx].id!,
    fileName: imageFiles[idx].name!,
    mimeType: imageFiles[idx].mimeType!,
    fileSize: parseInt(imageFiles[idx].size || '0'),
    userId,
    roomId,
    capturedAt,
  }));

  console.log(`[Import Job ${jobId}] Sending ${messages.length} messages to SQS`);
  await sendBatchToQueue(messages);
  console.log(`[Import Job ${jobId}] Successfully sent messages to SQS`);

  // Update status to PROCESSING
  await prisma.importJob.update({
    where: { id: jobId },
    data: { status: 'PROCESSING' },
  });
  console.log(`[Import Job ${jobId}] Updated job status to PROCESSING - waiting for Lambda`);
}

// GET endpoint to fetch job status
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const jobId = searchParams.get('jobId');

    if (jobId) {
      // Get specific job
      const job = await prisma.importJob.findUnique({
        where: { id: jobId, userId: session.user.id },
        include: {
          room: true,
          files: {
            orderBy: { createdAt: 'desc' },
            take: 100, // Limit to prevent large payloads
          },
        },
      });

      if (!job) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      }

      // Recalculate actual progress from file counts (fixes counter drift)
      const fileStats = await prisma.importJobFile.groupBy({
        by: ['status'],
        where: { jobId },
        _count: true,
      });

      const actualCompleted = fileStats.find(s => s.status === 'COMPLETED')?._count || 0;
      const actualFailed = fileStats.find(s => s.status === 'FAILED')?._count || 0;
      const actualProcessed = actualCompleted + actualFailed;

      // If counters don't match, update them
      if (actualProcessed !== job.processedFiles || actualCompleted !== job.successFiles || actualFailed !== job.failedFiles) {
        const newStatus = actualProcessed >= job.totalFiles ? 'COMPLETED' : job.status;

        await prisma.importJob.update({
          where: { id: jobId },
          data: {
            processedFiles: actualProcessed,
            successFiles: actualCompleted,
            failedFiles: actualFailed,
            status: newStatus,
          },
        });

        console.log(`[Job ${jobId}] Reconciled counters: ${job.processedFiles}->${actualProcessed}, status: ${job.status}->${newStatus}`);

        // Update the job object to return correct values
        job.processedFiles = actualProcessed;
        job.successFiles = actualCompleted;
        job.failedFiles = actualFailed;
        job.status = newStatus;
      }

      return NextResponse.json({ job });
    } else {
      // List all jobs for user
      const jobs = await prisma.importJob.findMany({
        where: { userId: session.user.id },
        include: {
          room: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      // Recalculate progress for any jobs that aren't completed
      for (const job of jobs) {
        if (job.status !== 'COMPLETED') {
          const fileStats = await prisma.importJobFile.groupBy({
            by: ['status'],
            where: { jobId: job.id },
            _count: true,
          });

          const actualCompleted = fileStats.find(s => s.status === 'COMPLETED')?._count || 0;
          const actualFailed = fileStats.find(s => s.status === 'FAILED')?._count || 0;
          const actualProcessed = actualCompleted + actualFailed;

          // If counters don't match, update them
          if (actualProcessed !== job.processedFiles || actualCompleted !== job.successFiles || actualFailed !== job.failedFiles) {
            const newStatus = actualProcessed >= job.totalFiles ? 'COMPLETED' : job.status;

            await prisma.importJob.update({
              where: { id: job.id },
              data: {
                processedFiles: actualProcessed,
                successFiles: actualCompleted,
                failedFiles: actualFailed,
                status: newStatus,
              },
            });

            console.log(`[Job ${job.id}] Reconciled counters: ${job.processedFiles}->${actualProcessed}, status: ${job.status}->${newStatus}`);

            // Update the job object to return correct values
            job.processedFiles = actualProcessed;
            job.successFiles = actualCompleted;
            job.failedFiles = actualFailed;
            job.status = newStatus;
          }
        }
      }

      return NextResponse.json({ jobs });
    }
  } catch (error) {
    console.error('Error fetching jobs:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}
