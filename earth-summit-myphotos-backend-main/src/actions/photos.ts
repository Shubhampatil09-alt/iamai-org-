'use server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { uploadToS3, deleteFromS3, getKeyFromUrl, getPresignedUrl } from '@/lib/s3-storage';
import { generateFaceEmbeddingsFromUrl } from '@/lib/embeddings';
import { revalidatePath } from 'next/cache';

export type UploadPhotoResult = {
  success: boolean;
  photoId?: string;
  error?: string;
};

export type BulkUploadResult = {
  success: boolean;
  results: UploadPhotoResult[];
  successCount: number;
  failureCount: number;
};

export type DeletePhotoResult = {
  success: boolean;
  error?: string;
};

export type BulkDeleteResult = {
  success: boolean;
  results: DeletePhotoResult[];
  successCount: number;
  failureCount: number;
};

export async function uploadPhoto(formData: FormData): Promise<UploadPhotoResult> {
  let azureUrl: string | null = null;

  try {
    // Check authentication and authorization
    const session = await auth();
    if (!session) {
      return { success: false, error: 'Unauthorized' };
    }

    if (session.user.role !== 'PHOTOGRAPHER' && session.user.role !== 'ADMIN') {
      return { success: false, error: 'Only photographers can upload photos' };
    }

    const file = formData.get('file') as File;
    const metadata = formData.get('metadata') as string | null;
    const capturedAtString = formData.get('capturedAt') as string | null;
    const roomId = formData.get('roomId') as string | null;

    if (!file) {
      return { success: false, error: 'No file provided' };
    }

    if (!roomId) {
      return { success: false, error: 'Room is required' };
    }

    // Verify room exists
    const room = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      return { success: false, error: 'Invalid room selected' };
    }

    // Use user's email as photographer identifier
    const photographerName = session.user.email || 'Unknown';

    // Upload to S3 (with photographer folder)
    azureUrl = await uploadToS3(file, photographerName);

    // Get presigned URL for the uploaded image
    const key = getKeyFromUrl(azureUrl);
    const presignedUrl = await getPresignedUrl(key, 3600); // 1 hour expiry

    // Generate face embeddings from S3 URL
    const faces = await generateFaceEmbeddingsFromUrl(presignedUrl);

    // Parse capturedAt date if provided
    const capturedAt = capturedAtString ? new Date(capturedAtString) : null;

    // Verify user exists in database
    const userExists = session.user.id ? await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true },
    }) : null;

    // Save to database with user association
    const photo = await prisma.photo.create({
      data: {
        azureUrl,
        photographer: photographerName,
        uploadedById: userExists ? session.user.id : null,
        roomId,
        metadata: metadata ? JSON.parse(metadata) : null,
        capturedAt,
      },
    });

    // Create face embeddings for all detected faces
    for (const face of faces) {
      const embeddingString = `[${face.embedding.join(',')}]`;
      const bboxJson = JSON.stringify(face.bbox);
      await prisma.$executeRaw`
        INSERT INTO face_embeddings (id, "photoId", embedding, "createdAt", "faceId", bbox, confidence)
        VALUES (gen_random_uuid()::text, ${photo.id}, ${embeddingString}::vector, NOW(), ${face.face_id}, ${bboxJson}::jsonb, ${face.confidence})
      `;
    }

    revalidatePath('/');
    return { success: true, photoId: photo.id };
  } catch (error) {
    console.error('Upload error:', error);

    // Clean up S3 file if upload failed after S3 upload
    if (azureUrl) {
      try {
        const key = getKeyFromUrl(azureUrl);
        await deleteFromS3(key);
      } catch (cleanupError) {
        console.error('Failed to cleanup S3 file:', cleanupError);
      }
    }

    return { success: false, error: error instanceof Error ? error.message : 'Upload failed' };
  }
}

export async function bulkUploadPhotos(formData: FormData): Promise<BulkUploadResult> {
  // Check authentication and authorization
  const session = await auth();
  if (!session) {
    return {
      success: false,
      results: [{ success: false, error: 'Unauthorized' }],
      successCount: 0,
      failureCount: 1,
    };
  }

  if (session.user.role !== 'PHOTOGRAPHER' && session.user.role !== 'ADMIN') {
    return {
      success: false,
      results: [{ success: false, error: 'Only photographers can upload photos' }],
      successCount: 0,
      failureCount: 1,
    };
  }

  const files = formData.getAll('files') as File[];
  const capturedAtString = formData.get('capturedAt') as string | null;
  const roomId = formData.get('roomId') as string | null;

  if (!files || files.length === 0) {
    return {
      success: false,
      results: [],
      successCount: 0,
      failureCount: 0,
    };
  }

  if (!roomId) {
    return {
      success: false,
      results: [{ success: false, error: 'Room is required' }],
      successCount: 0,
      failureCount: 1,
    };
  }

  // Verify room exists
  const room = await prisma.room.findUnique({
    where: { id: roomId },
  });

  if (!room) {
    return {
      success: false,
      results: [{ success: false, error: 'Invalid room selected' }],
      successCount: 0,
      failureCount: 1,
    };
  }

  // Use user's email as photographer identifier
  const photographerName = session.user.email || 'Unknown';

  // Parse capturedAt date if provided
  const capturedAt = capturedAtString ? new Date(capturedAtString) : null;

  // Verify user exists in database
  const userExists = session.user.id ? await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true },
  }) : null;

  const results: UploadPhotoResult[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const file of files) {
    try {
      const azureUrl = await uploadToS3(file, photographerName);

      // Get presigned URL for the uploaded image
      const key = getKeyFromUrl(azureUrl);
      const presignedUrl = await getPresignedUrl(key, 3600); // 1 hour expiry

      // Generate face embeddings from S3 URL
      const faces = await generateFaceEmbeddingsFromUrl(presignedUrl);

      const photo = await prisma.photo.create({
        data: {
          azureUrl,
          photographer: photographerName,
          uploadedById: userExists ? session.user.id : null,
          roomId,
          metadata: {},
          capturedAt,
        },
      });

      // Create face embeddings for all detected faces
      for (const face of faces) {
        const embeddingString = `[${face.embedding.join(',')}]`;
        const bboxJson = JSON.stringify(face.bbox);
        await prisma.$executeRaw`
          INSERT INTO face_embeddings (id, "photoId", embedding, "createdAt", "faceId", bbox, confidence)
          VALUES (gen_random_uuid()::text, ${photo.id}, ${embeddingString}::vector, NOW(), ${face.face_id}, ${bboxJson}::jsonb, ${face.confidence})
        `;
      }

      results.push({ success: true, photoId: photo.id });
      successCount++;
    } catch (error) {
      console.error('Bulk upload error:', error);
      results.push({
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      });
      failureCount++;
    }
  }

  revalidatePath('/');

  return {
    success: successCount > 0,
    results,
    successCount,
    failureCount,
  };
}

async function processPhotoUpload(
  file: File,
  photographerName: string,
  uploadedById: string | null,
  roomId: string,
  capturedAt: Date | null
): Promise<UploadPhotoResult> {
  let azureUrl: string | null = null;

  try {
    // Upload to S3
    azureUrl = await uploadToS3(file, photographerName);

    // Get presigned URL for the uploaded image
    const key = getKeyFromUrl(azureUrl);
    const presignedUrl = await getPresignedUrl(key, 3600); // 1 hour expiry

    // Generate face embeddings from S3 URL
    const faces = await generateFaceEmbeddingsFromUrl(presignedUrl);

    // Create photo record
    const photo = await prisma.photo.create({
      data: {
        azureUrl,
        photographer: photographerName,
        uploadedById,
        roomId,
        metadata: {},
        capturedAt,
      },
    });

    // Create face embeddings for all detected faces
    for (const face of faces) {
      const embeddingString = `[${face.embedding.join(',')}]`;
      const bboxJson = JSON.stringify(face.bbox);
      await prisma.$executeRaw`
        INSERT INTO face_embeddings (id, "photoId", embedding, "createdAt", "faceId", bbox, confidence)
        VALUES (gen_random_uuid()::text, ${photo.id}, ${embeddingString}::vector, NOW(), ${face.face_id}, ${bboxJson}::jsonb, ${face.confidence})
      `;
    }

    return { success: true, photoId: photo.id };
  } catch (error) {
    // Clean up S3 file if upload failed after S3 upload
    if (azureUrl) {
      try {
        const key = getKeyFromUrl(azureUrl);
        await deleteFromS3(key);
      } catch (cleanupError) {
        console.error('Failed to cleanup S3 file:', cleanupError);
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

export async function uploadPhotosBatch(
  files: File[],
  roomId: string,
  capturedAt: Date | null
): Promise<BulkUploadResult> {
  // Check authentication and authorization
  const session = await auth();
  if (!session) {
    return {
      success: false,
      results: [{ success: false, error: 'Unauthorized' }],
      successCount: 0,
      failureCount: 1,
    };
  }

  if (session.user.role !== 'PHOTOGRAPHER' && session.user.role !== 'ADMIN') {
    return {
      success: false,
      results: [{ success: false, error: 'Only photographers can upload photos' }],
      successCount: 0,
      failureCount: 1,
    };
  }

  if (!files || files.length === 0) {
    return {
      success: false,
      results: [],
      successCount: 0,
      failureCount: 0,
    };
  }

  // Verify room exists
  const room = await prisma.room.findUnique({
    where: { id: roomId },
  });

  if (!room) {
    return {
      success: false,
      results: [{ success: false, error: 'Invalid room selected' }],
      successCount: 0,
      failureCount: 1,
    };
  }

  // Use user's email as photographer identifier
  const photographerName = session.user.email || 'Unknown';

  // Verify user exists in database
  const userExists = session.user.id ? await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true },
  }) : null;

  const uploadedById = userExists ? session.user.id : null;

  // Process all files in parallel
  const results = await Promise.all(
    files.map(file => processPhotoUpload(file, photographerName, uploadedById, roomId, capturedAt))
  );

  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;

  revalidatePath('/');

  return {
    success: successCount > 0,
    results,
    successCount,
    failureCount,
  };
}

export async function deletePhoto(photoId: string): Promise<DeletePhotoResult> {
  try {
    // Check authentication
    const session = await auth();
    if (!session) {
      return { success: false, error: 'Unauthorized' };
    }

    const photo = await prisma.photo.findUnique({
      where: { id: photoId },
    });

    if (!photo) {
      return { success: false, error: 'Photo not found' };
    }

    // Check if user owns the photo or is an admin
    if (photo.uploadedById !== session.user.id && session.user.role !== 'ADMIN') {
      return { success: false, error: 'You can only delete your own photos' };
    }

    // Delete from S3
    const key = getKeyFromUrl(photo.azureUrl);
    await deleteFromS3(key);

    // Delete from database (cascade will delete face embeddings)
    await prisma.photo.delete({
      where: { id: photoId },
    });

    revalidatePath('/');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    console.error('Delete error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Delete failed' };
  }
}

export async function bulkDeletePhotos(photoIds: string[]): Promise<BulkDeleteResult> {
  // Check authentication
  const session = await auth();
  if (!session) {
    return {
      success: false,
      results: [{ success: false, error: 'Unauthorized' }],
      successCount: 0,
      failureCount: 1,
    };
  }

  if (!photoIds || photoIds.length === 0) {
    return {
      success: false,
      results: [],
      successCount: 0,
      failureCount: 0,
    };
  }

  const results: DeletePhotoResult[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const photoId of photoIds) {
    try {
      const photo = await prisma.photo.findUnique({
        where: { id: photoId },
      });

      if (!photo) {
        results.push({ success: false, error: 'Photo not found' });
        failureCount++;
        continue;
      }

      // Check if user owns the photo or is an admin
      if (photo.uploadedById !== session.user.id && session.user.role !== 'ADMIN') {
        results.push({ success: false, error: 'Unauthorized' });
        failureCount++;
        continue;
      }

      const key = getKeyFromUrl(photo.azureUrl);
      await deleteFromS3(key);

      await prisma.photo.delete({
        where: { id: photoId },
      });

      results.push({ success: true });
      successCount++;
    } catch (error) {
      console.error('Bulk delete error:', error);
      results.push({
        success: false,
        error: error instanceof Error ? error.message : 'Delete failed',
      });
      failureCount++;
    }
  }

  revalidatePath('/');
  revalidatePath('/dashboard');

  return {
    success: successCount > 0,
    results,
    successCount,
    failureCount,
  };
}

export async function getPhotos(page: number = 1, limit: number = 20) {
  try {
    const skip = (page - 1) * limit;

    const [photos, total] = await Promise.all([
      prisma.photo.findMany({
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.photo.count(),
    ]);

    // Generate presigned URLs for each photo
    const photosWithPresignedUrls = await Promise.all(
      photos.map(async (photo) => {
        const key = getKeyFromUrl(photo.azureUrl);
        const presignedUrl = await getPresignedUrl(key);
        return {
          ...photo,
          blobName: key,
          presignedUrl,
        };
      })
    );

    return {
      photos: photosWithPresignedUrls,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    console.error('Get photos error:', error);
    return {
      photos: [],
      total: 0,
      page: 1,
      limit,
      totalPages: 0,
    };
  }
}

export async function getPhotographers() {
  try {
    const photographers = await prisma.photo.findMany({
      distinct: ['photographer'],
      select: {
        photographer: true,
      },
      orderBy: {
        photographer: 'asc',
      },
    });

    return photographers
      .map(p => p.photographer)
      .filter((p): p is string => p !== null);
  } catch (error) {
    console.error('Get photographers error:', error);
    return [];
  }
}

export async function getPhotosByPhotographer() {
  try {
    const photos = await prisma.photo.findMany({
      orderBy: [
        {
          photographer: 'asc',
        },
        {
          createdAt: 'desc',
        },
      ],
    });

    // Generate presigned URLs for each photo
    const photosWithPresignedUrls = await Promise.all(
      photos.map(async (photo) => {
        const key = getKeyFromUrl(photo.azureUrl);
        const presignedUrl = await getPresignedUrl(key);
        return {
          ...photo,
          blobName: key,
          presignedUrl,
        };
      })
    );

    // Group by photographer
    const grouped = photosWithPresignedUrls.reduce((acc, photo) => {
      const photographer = photo.photographer || 'Unknown';
      if (!acc[photographer]) {
        acc[photographer] = [];
      }
      acc[photographer].push(photo);
      return acc;
    }, {} as Record<string, typeof photosWithPresignedUrls>);

    return grouped;
  } catch (error) {
    console.error('Get photos by photographer error:', error);
    return {};
  }
}

export async function deletePhotographerPhotos(photographer: string): Promise<{
  success: boolean;
  deletedCount: number;
  error?: string;
}> {
  try {
    // Check authentication
    const session = await auth();
    if (!session) {
      return { success: false, deletedCount: 0, error: 'Unauthorized' };
    }

    // Get all photos by photographer
    const photos = await prisma.photo.findMany({
      where: {
        photographer: photographer === 'Unknown' ? null : photographer,
      },
    });

    if (photos.length === 0) {
      return { success: false, deletedCount: 0, error: 'No photos found' };
    }

    let deletedCount = 0;

    // Delete from S3 and database
    for (const photo of photos) {
      try {
        // Check if user owns the photo or is an admin
        if (photo.uploadedById !== session.user.id && session.user.role !== 'ADMIN') {
          continue; // Skip photos user doesn't own
        }

        const key = getKeyFromUrl(photo.azureUrl);
        await deleteFromS3(key);

        await prisma.photo.delete({
          where: { id: photo.id },
        });

        deletedCount++;
      } catch (error) {
        console.error(`Failed to delete photo ${photo.id}:`, error);
      }
    }

    revalidatePath('/');
    revalidatePath('/dashboard');

    return {
      success: deletedCount > 0,
      deletedCount,
      error: deletedCount === 0 ? 'All deletions failed' : undefined,
    };
  } catch (error) {
    console.error('Delete photographer photos error:', error);
    return {
      success: false,
      deletedCount: 0,
      error: error instanceof Error ? error.message : 'Delete failed',
    };
  }
}

export async function getPhotosByRoom(roomId?: string) {
  try {
    // Build where clause
    const where = roomId ? { roomId } : {};

    // First, get the structure (rooms and uploaders) with counts only
    const photos = await prisma.photo.findMany({
      where,
      select: {
        id: true,
        createdAt: true,
        room: {
          select: {
            id: true,
            name: true,
          },
        },
        uploadedBy: {
          select: {
            id: true,
            email: true,
          },
        },
        photographer: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const total = photos.length;

    // Group by room and uploader to get structure and counts
    const groupedStructure = photos.reduce((acc, photo) => {
      const roomName = photo.room.name;
      const uploader = photo.uploadedBy?.email || photo.photographer || 'Unknown';

      if (!acc[roomName]) {
        acc[roomName] = {
          room: photo.room,
          uploaders: {},
        };
      }

      if (!acc[roomName].uploaders[uploader]) {
        acc[roomName].uploaders[uploader] = {
          photos: [],
          total: 0,
        };
      }

      acc[roomName].uploaders[uploader].total++;
      return acc;
    }, {} as Record<string, {
      room: typeof photos[0]['room'],
      uploaders: Record<string, { photos: any[], total: number }>
    }>);

    return {
      photosByRoom: groupedStructure,
      total,
    };
  } catch (error) {
    console.error('Get photos by room error:', error);
    return {
      photosByRoom: {},
      total: 0,
    };
  }
}

export async function getPhotosByUploader(roomId: string, uploaderId: string, limit: number = 50, offset: number = 0) {
  try {
    // Build where clause to filter by room and uploader
    const where: any = {
      roomId,
    };

    if (uploaderId === 'Unknown') {
      where.uploadedById = null;
    } else {
      // Filter by the uploader's email through the relation
      where.uploadedBy = {
        email: uploaderId,
      };
    }

    const photos = await prisma.photo.findMany({
      where,
      include: {
        room: true,
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    });

    // Generate presigned URLs for each photo
    const photosWithPresignedUrls = await Promise.all(
      photos.map(async (photo) => {
        const key = getKeyFromUrl(photo.azureUrl);
        const presignedUrl = await getPresignedUrl(key);
        return {
          ...photo,
          blobName: key,
          presignedUrl,
        };
      })
    );

    return {
      photos: photosWithPresignedUrls,
      hasMore: photos.length === limit,
    };
  } catch (error) {
    console.error('Get photos by uploader error:', error);
    return {
      photos: [],
      hasMore: false,
    };
  }
}

export async function getRooms() {
  try {
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

    return rooms;
  } catch (error) {
    console.error('Get rooms error:', error);
    return [];
  }
}
