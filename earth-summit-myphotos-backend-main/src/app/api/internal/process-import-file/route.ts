import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// This endpoint is called by Lambda to update database after processing a file
// It handles all database operations

export async function POST(request: NextRequest) {
  try {
    // Verify internal API key for security
    const apiKey = request.headers.get('x-api-key');
    if (apiKey !== process.env.API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    if (action === 'update_file_status') {
      const { fileId, status, errorMessage } = body;

      await prisma.importJobFile.update({
        where: { id: fileId },
        data: {
          status,
          errorMessage: errorMessage || null,
        },
      });

      return NextResponse.json({ success: true });
    }

    if (action === 'save_photo') {
      const { fileId, jobId, userId, roomId, azureUrl, photographerName, fileName, capturedAt, faces } = body;

      // Check if job was cancelled
      const job = await prisma.importJob.findUnique({
        where: { id: jobId },
        select: { status: true, folderName: true },
      });

      if (!job) {
        console.log(`[Job ${jobId}] Job not found, skipping file ${fileName}`);
        return NextResponse.json({ success: false, reason: 'job_not_found' });
      }

      if (job.status === 'CANCELLED') {
        console.log(`[Job ${jobId}] Job cancelled, skipping file ${fileName}`);

        // SCENARIO 2: Clean up orphaned S3 file uploaded by Lambda after cancellation
        // NOTE: Commented out pending approval - prevents orphaned files in S3
        // To enable: Uncomment the import at top and the code block below
        // import { deleteFromS3, getKeyFromUrl } from '@/lib/s3-storage';

        // try {
        //   const key = getKeyFromUrl(azureUrl);
        //   await deleteFromS3(key);
        //   console.log(`[Job ${jobId}] Deleted orphaned S3 file after cancellation: ${fileName}`);
        // } catch (error) {
        //   console.error(`[Job ${jobId}] Failed to delete orphaned S3 file ${azureUrl}:`, error);
        // }

        return NextResponse.json({ success: false, reason: 'job_cancelled' });
      }

      // Create photo record
      const photo = await prisma.photo.create({
        data: {
          azureUrl,
          photographer: photographerName,
          uploadedById: userId,
          roomId,
          metadata: { importedFrom: 'google-drive', originalFileName: fileName },
          capturedAt: capturedAt ? new Date(capturedAt) : null,
        },
      });

      // Create face embeddings
      for (const face of faces) {
        const embeddingString = `[${face.embedding.join(',')}]`;
        const bboxJson = JSON.stringify(face.bbox);
        await prisma.$executeRaw`
          INSERT INTO face_embeddings (id, "photoId", embedding, "createdAt", "faceId", bbox, confidence)
          VALUES (gen_random_uuid()::text, ${photo.id}, ${embeddingString}::vector, NOW(), ${face.face_id}, ${bboxJson}::jsonb, ${face.confidence})
        `;
      }

      // Update file status to COMPLETED
      await prisma.importJobFile.update({
        where: { id: fileId },
        data: {
          status: 'COMPLETED',
          photoId: photo.id,
        },
      });

      // Update job progress - increment success
      await updateJobProgress(jobId, true);

      return NextResponse.json({ success: true, photoId: photo.id });
    }

    if (action === 'increment_retry') {
      const { fileId, errorMessage } = body;

      const file = await prisma.importJobFile.findUnique({
        where: { id: fileId },
        select: { retryCount: true, jobId: true, fileName: true },
      });

      if (!file) {
        console.error(`[File ${fileId}] File not found for retry`);
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
      }

      const maxRetries = parseInt(process.env.GDRIVE_MAX_RETRIES || '3');
      const newRetryCount = file.retryCount + 1;
      const isFinalFailure = newRetryCount >= maxRetries;

      console.log(`[Job ${file.jobId}] Retry ${newRetryCount}/${maxRetries} - ${file.fileName}: ${errorMessage}`);

      await prisma.importJobFile.update({
        where: { id: fileId },
        data: {
          status: isFinalFailure ? 'FAILED' : 'QUEUED',
          retryCount: newRetryCount,
          errorMessage,
        },
      });

      // If final failure, update job progress
      if (isFinalFailure) {
        console.log(`[Job ${file.jobId}] File FAILED after max retries: ${file.fileName}`);
        await updateJobProgress(file.jobId, false);
      }

      return NextResponse.json({ success: true, shouldRetry: !isFinalFailure });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Internal API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}

async function updateJobProgress(jobId: string, success: boolean) {
  await prisma.$transaction(async (tx) => {
    const job = await tx.importJob.findUnique({
      where: { id: jobId },
      select: { processedFiles: true, successFiles: true, failedFiles: true, totalFiles: true, folderName: true },
    });

    if (job) {
      const newProcessedFiles = job.processedFiles + 1;
      const newSuccessFiles = success ? job.successFiles + 1 : job.successFiles;
      const newFailedFiles = success ? job.failedFiles : job.failedFiles + 1;
      const newStatus = newProcessedFiles >= job.totalFiles ? 'COMPLETED' : 'PROCESSING';

      await tx.importJob.update({
        where: { id: jobId },
        data: {
          processedFiles: newProcessedFiles,
          successFiles: newSuccessFiles,
          failedFiles: newFailedFiles,
          status: newStatus,
        },
      });

      if (newStatus === 'COMPLETED') {
        console.log(`[Job ${jobId}] ✅ COMPLETED - ${job.folderName}: ${newSuccessFiles} success, ${newFailedFiles} failed`);
      }
    } else {
      console.error(`[Job ${jobId}] Job not found when updating progress!`);
    }
  });
}
