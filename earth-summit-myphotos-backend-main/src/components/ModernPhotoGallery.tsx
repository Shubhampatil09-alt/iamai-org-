'use client';

import { useState, useCallback } from 'react';
import { deletePhoto, bulkDeletePhotos, getPhotosByUploader } from '@/actions/photos';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Trash2, Folder, Image as ImageIcon, CheckCircle2, User, DoorOpen, Loader2 } from 'lucide-react';
import UploadDialog from './UploadDialog';

type Photo = {
  id: string;
  photographer: string | null;
  azureUrl: string;
  blobName: string;
  presignedUrl: string;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
  capturedAt: Date | null;
  uploadedBy: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  room: {
    id: string;
    name: string;
  };
};

type RoomData = {
  room: {
    id: string;
    name: string;
  };
  uploaders: Record<string, {
    photos: Photo[];
    total: number;
  }>;
};

type PhotosByRoom = Record<string, RoomData>;

type ModernPhotoGalleryProps = {
  photosByRoom: PhotosByRoom;
  userRole?: string | null;
  totalPhotos: number;
};

export default function ModernPhotoGallery({
  photosByRoom,
  userRole,
  totalPhotos
}: ModernPhotoGalleryProps) {
  const router = useRouter();
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadMode, setUploadMode] = useState<'single' | 'bulk'>('single');

  // Track loaded photos per uploader
  const [loadedPhotos, setLoadedPhotos] = useState<Record<string, Photo[]>>({});
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const [hasMoreStates, setHasMoreStates] = useState<Record<string, boolean>>({});
  const PHOTOS_PER_PAGE = 50;

  const togglePhotoSelection = (photoId: string) => {
    const newSelected = new Set(selectedPhotos);
    if (newSelected.has(photoId)) {
      newSelected.delete(photoId);
    } else {
      newSelected.add(photoId);
    }
    setSelectedPhotos(newSelected);
  };

  const getUploaderKey = (roomId: string, uploader: string) => `${roomId}-${uploader}`;

  const loadPhotos = useCallback(async (roomId: string, uploader: string, append: boolean = false) => {
    const key = getUploaderKey(roomId, uploader);

    setLoadingStates(prev => ({ ...prev, [key]: true }));

    const currentPhotos = loadedPhotos[key] || [];
    const offset = append ? currentPhotos.length : 0;

    const result = await getPhotosByUploader(roomId, uploader, PHOTOS_PER_PAGE, offset);

    setLoadedPhotos(prev => ({
      ...prev,
      [key]: append ? [...(prev[key] || []), ...result.photos] : result.photos
    }));

    setHasMoreStates(prev => ({ ...prev, [key]: result.hasMore }));
    setLoadingStates(prev => ({ ...prev, [key]: false }));
  }, [loadedPhotos]);

  const handleAccordionChange = useCallback((roomId: string, uploader: string) => {
    const key = getUploaderKey(roomId, uploader);
    // Load photos if not already loaded
    if (!loadedPhotos[key]) {
      loadPhotos(roomId, uploader, false);
    }
  }, [loadedPhotos, loadPhotos]);

  const loadMorePhotos = (roomId: string, uploader: string) => {
    loadPhotos(roomId, uploader, true);
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm('Delete this photo?')) return;

    setDeleting(true);
    const result = await deletePhoto(photoId);

    if (result.success) {
      router.refresh();
    } else {
      alert(`Delete failed: ${result.error}`);
    }
    setDeleting(false);
  };

  const handleBulkDelete = async () => {
    if (selectedPhotos.size === 0) return;
    if (!confirm(`Delete ${selectedPhotos.size} selected photos?`)) return;

    setDeleting(true);
    const result = await bulkDeletePhotos(Array.from(selectedPhotos));

    if (result.success) {
      setSelectedPhotos(new Set());
      router.refresh();
    } else {
      alert('Bulk delete failed');
    }
    setDeleting(false);
  };

  // Calculate totals
  const totalRooms = Object.keys(photosByRoom).length;
  const totalUploaders = Object.values(photosByRoom).reduce((sum, roomData) => {
    return sum + Object.keys(roomData.uploaders).length;
  }, 0);

  // Check if user is photographer or admin
  const canUpload = userRole === 'PHOTOGRAPHER' || userRole === 'ADMIN';
  const canDelete = userRole === 'PHOTOGRAPHER' || userRole === 'ADMIN';

  return (
    <div className="space-y-8">
      {/* Header Actions - Only show for photographers and admins */}
      {canUpload && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              size="lg"
              onClick={() => {
                setUploadMode('single');
                setUploadDialogOpen(true);
              }}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
            >
              <ImageIcon className="mr-2 h-5 w-5" />
              Upload Photo
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => {
                setUploadMode('bulk');
                setUploadDialogOpen(true);
              }}
            >
              <Folder className="mr-2 h-5 w-5" />
              Bulk Upload
            </Button>
          </div>

          {selectedPhotos.size > 0 && (
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="text-sm px-3 py-1">
                {selectedPhotos.size} selected
              </Badge>
              <Button
                variant="destructive"
                onClick={handleBulkDelete}
                disabled={deleting}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Selected
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="text-sm font-medium text-muted-foreground">Total Photos</div>
          <div className="text-3xl font-bold mt-2">{totalPhotos}</div>
        </Card>
        <Card className="p-6">
          <div className="text-sm font-medium text-muted-foreground">Rooms</div>
          <div className="text-3xl font-bold mt-2">{totalRooms}</div>
        </Card>
        <Card className="p-6">
          <div className="text-sm font-medium text-muted-foreground">Selected</div>
          <div className="text-3xl font-bold mt-2">{selectedPhotos.size}</div>
        </Card>
      </div>

      {/* Nested Accordions: Room > Uploader */}
      {Object.keys(photosByRoom).length === 0 ? (
        <Card className="p-12 text-center">
          <ImageIcon className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">No photos yet</h3>
          <p className="text-muted-foreground mb-6">
            {canUpload
              ? 'Upload your first photo to get started'
              : 'No photos available'}
          </p>
          {canUpload && (
            <Button
              size="lg"
              onClick={() => {
                setUploadMode('single');
                setUploadDialogOpen(true);
              }}
            >
              <ImageIcon className="mr-2 h-5 w-5" />
              Upload Photo
            </Button>
          )}
        </Card>
      ) : (
        <Accordion type="multiple" className="space-y-4">
          {Object.entries(photosByRoom).map(([roomName, roomData]) => {
            const roomPhotoCount = Object.values(roomData.uploaders).reduce(
              (sum, uploaderData) => sum + uploaderData.total,
              0
            );

            return (
              <AccordionItem
                key={roomData.room.id}
                value={roomData.room.id}
                className="border rounded-lg overflow-hidden"
              >
                <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3 w-full">
                    <DoorOpen className="h-5 w-5 text-primary" />
                    <span className="text-lg font-semibold">{roomName}</span>
                    <div className="ml-auto flex items-center gap-2 mr-4">
                      <Badge variant="secondary">
                        {roomPhotoCount} {roomPhotoCount === 1 ? 'photo' : 'photos'}
                      </Badge>
                      <Badge variant="outline">
                        {Object.keys(roomData.uploaders).length} {Object.keys(roomData.uploaders).length === 1 ? 'uploader' : 'uploaders'}
                      </Badge>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6 pt-2">
                  {/* Nested Accordion for Uploaders */}
                  <Accordion type="multiple" className="space-y-3">
                    {Object.entries(roomData.uploaders).map(([uploader, uploaderData]) => {
                      const key = getUploaderKey(roomData.room.id, uploader);
                      const photos = loadedPhotos[key] || [];
                      const isLoading = loadingStates[key] || false;
                      const hasMore = hasMoreStates[key] || false;

                      return (
                        <AccordionItem
                          key={key}
                          value={key}
                          className="border rounded-md overflow-hidden bg-muted/30"
                        >
                          <AccordionTrigger
                            className="px-4 py-3 hover:no-underline hover:bg-muted/50 transition-colors"
                            onClick={() => handleAccordionChange(roomData.room.id, uploader)}
                          >
                            <div className="flex items-center gap-3 w-full">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="text-base font-medium">{uploader}</span>
                              <div className="ml-auto mr-4">
                                <Badge variant="secondary" className="text-xs">
                                  {uploaderData.total} {uploaderData.total === 1 ? 'photo' : 'photos'}
                                </Badge>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-4 pb-4 pt-2">
                            <div className="space-y-4">
                              {isLoading && photos.length === 0 ? (
                                <div className="flex justify-center items-center py-12">
                                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                </div>
                              ) : (
                                <>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                    {photos.map((photo) => (
                                      <Card
                                        key={photo.id}
                                        className={`group relative overflow-hidden cursor-pointer transition-all hover:shadow-lg ${
                                          selectedPhotos.has(photo.id) ? 'ring-2 ring-primary' : ''
                                        }`}
                                        onClick={() => togglePhotoSelection(photo.id)}
                                      >
                                        <div className="aspect-square relative bg-muted">
                                          <Image
                                            src={photo.presignedUrl}
                                            alt={photo.uploadedBy?.name || 'Photo'}
                                            fill
                                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                                          />
                                          {selectedPhotos.has(photo.id) && (
                                            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                              <CheckCircle2 className="h-12 w-12 text-primary drop-shadow-lg" />
                                            </div>
                                          )}
                                        </div>
                                        <div className="p-3 space-y-2">
                                          <p className="text-xs text-muted-foreground">
                                            {photo.capturedAt ? new Date(photo.capturedAt).toLocaleDateString() : 'No date'}
                                          </p>
                                          {canDelete && (
                                            <Button
                                              variant="destructive"
                                              size="sm"
                                              className="w-full"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeletePhoto(photo.id);
                                              }}
                                              disabled={deleting}
                                            >
                                              <Trash2 className="mr-1 h-3 w-3" />
                                              Delete
                                            </Button>
                                          )}
                                        </div>
                                      </Card>
                                    ))}
                                  </div>

                                  {/* Load More Button */}
                                  {hasMore && (
                                    <div className="flex justify-center pt-2">
                                      <Button
                                        variant="outline"
                                        onClick={() => loadMorePhotos(roomData.room.id, uploader)}
                                        disabled={isLoading}
                                        className="w-full max-w-xs"
                                      >
                                        {isLoading ? (
                                          <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Loading...
                                          </>
                                        ) : (
                                          `Load More (${uploaderData.total - photos.length} remaining)`
                                        )}
                                      </Button>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}


      {canUpload && (
        <UploadDialog
          open={uploadDialogOpen}
          onOpenChange={setUploadDialogOpen}
          mode={uploadMode}
        />
      )}
    </div>
  );
}
