import { prisma } from './prisma';
import { downloadFile } from './google-drive';
import { uploadToS3, getKeyFromUrl, getPresignedUrl, deleteFromS3 } from './s3-storage';
import { generateFaceEmbeddingsFromUrl } from './embeddings';
import type { SQSImportMessage } from '@/types/google-drive';

export async function processImportFile(message: SQSImportMessage) {
  const { jobId, fileId, googleDriveFileId, fileName, mimeType, fileSize, userId, roomId, capturedAt } = message;

  let azureUrl: string | null = null;

  try {
    // Update file status to DOWNLOADING
    await prisma.importJobFile.update({
      where: { id: fileId },
      data: { status: 'DOWNLOADING' },
    });

    // Download file from Google Drive
    const fileBuffer = await downloadFile(userId, googleDriveFileId);

    // Create File object for upload (convert Buffer to Uint8Array for compatibility)
    const file = new File([new Uint8Array(fileBuffer)], fileName, { type: mimeType });

    // Update status to UPLOADING
    await prisma.importJobFile.update({
      where: { id: fileId },
      data: { status: 'UPLOADING' },
    });

    // Get user info for photographer name
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    const photographerName = user?.email || 'Unknown';

    // Upload to S3
    azureUrl = await uploadToS3(file, photographerName);

    // Update status to PROCESSING_EMBEDDINGS
    await prisma.importJobFile.update({
      where: { id: fileId },
      data: { status: 'PROCESSING_EMBEDDINGS' },
    });

    // Get presigned URL
    const key = getKeyFromUrl(azureUrl);
    const presignedUrl = await getPresignedUrl(key, 3600);

    // Generate face embeddings
    const faces = await generateFaceEmbeddingsFromUrl(presignedUrl);

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

    // Update job progress
    await prisma.$transaction(async (tx) => {
      const job = await tx.importJob.findUnique({
        where: { id: jobId },
        select: { processedFiles: true, successFiles: true, totalFiles: true },
      });

      if (job) {
        const newProcessedFiles = job.processedFiles + 1;
        const newSuccessFiles = job.successFiles + 1;

        await tx.importJob.update({
          where: { id: jobId },
          data: {
            processedFiles: newProcessedFiles,
            successFiles: newSuccessFiles,
            status: newProcessedFiles >= job.totalFiles ? 'COMPLETED' : 'PROCESSING',
          },
        });
      }
    });

    return { success: true, photoId: photo.id };
  } catch (error) {
    console.error(`Error processing file ${fileName}:`, error);

    // Clean up S3 file if uploaded
    if (azureUrl) {
      try {
        const key = getKeyFromUrl(azureUrl);
        await deleteFromS3(key);
      } catch (cleanupError) {
        console.error('Failed to cleanup S3 file:', cleanupError);
      }
    }

    // Update file status and retry count
    const file = await prisma.importJobFile.findUnique({
      where: { id: fileId },
      select: { retryCount: true },
    });

    const maxRetries = parseInt(process.env.GDRIVE_MAX_RETRIES || '3');
    const newRetryCount = (file?.retryCount || 0) + 1;
    const isFinalFailure = newRetryCount >= maxRetries;

    await prisma.importJobFile.update({
      where: { id: fileId },
      data: {
        status: isFinalFailure ? 'FAILED' : 'QUEUED',
        retryCount: newRetryCount,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    // Update job progress if final failure
    if (isFinalFailure) {
      await prisma.$transaction(async (tx) => {
        const job = await tx.importJob.findUnique({
          where: { id: jobId },
          select: { processedFiles: true, failedFiles: true, totalFiles: true },
        });

        if (job) {
          const newProcessedFiles = job.processedFiles + 1;
          const newFailedFiles = job.failedFiles + 1;

          await tx.importJob.update({
            where: { id: jobId },
            data: {
              processedFiles: newProcessedFiles,
              failedFiles: newFailedFiles,
              status: newProcessedFiles >= job.totalFiles ? 'COMPLETED' : 'PROCESSING',
            },
          });
        }
      });
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      shouldRetry: !isFinalFailure,
    };
  }
}
