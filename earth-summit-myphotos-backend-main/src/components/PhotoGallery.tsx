'use client';

import { useState } from 'react';
import { uploadPhoto, bulkUploadPhotos, deletePhoto, bulkDeletePhotos } from '@/actions/photos';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Photo = {
  id: string;
  photographer: string | null;
  azureUrl: string;
  blobName: string;
  presignedUrl: string;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
};

type PhotoData = {
  photos: Photo[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export default function PhotoGallery({ initialData }: { initialData: PhotoData }) {
  const router = useRouter();
  const [photos, setPhotos] = useState(initialData.photos);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSingleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    setUploading(true);
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);

    const result = await uploadPhoto(formData);

    if (result.success) {
      router.refresh();
    } else {
      alert(`Upload failed: ${result.error}`);
    }
    setUploading(false);
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    setUploading(true);
    const formData = new FormData();
    Array.from(e.target.files).forEach(file => {
      formData.append('files', file);
    });

    const result = await bulkUploadPhotos(formData);

    if (result.success) {
      alert(`Uploaded ${result.successCount} photos. Failed: ${result.failureCount}`);
      router.refresh();
    } else {
      alert('Bulk upload failed');
    }
    setUploading(false);
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm('Are you sure you want to delete this photo?')) return;

    setDeleting(true);
    const result = await deletePhoto(photoId);

    if (result.success) {
      setPhotos(photos.filter(p => p.id !== photoId));
      selectedPhotos.delete(photoId);
      setSelectedPhotos(new Set(selectedPhotos));
    } else {
      alert(`Delete failed: ${result.error}`);
    }
    setDeleting(false);
  };

  const handleBulkDelete = async () => {
    if (selectedPhotos.size === 0) {
      alert('No photos selected');
      return;
    }

    if (!confirm(`Delete ${selectedPhotos.size} photos?`)) return;

    setDeleting(true);
    const result = await bulkDeletePhotos(Array.from(selectedPhotos));

    if (result.success) {
      alert(`Deleted ${result.successCount} photos. Failed: ${result.failureCount}`);
      router.refresh();
    } else {
      alert('Bulk delete failed');
    }
    setDeleting(false);
  };

  const togglePhotoSelection = (photoId: string) => {
    const newSelected = new Set(selectedPhotos);
    if (newSelected.has(photoId)) {
      newSelected.delete(photoId);
    } else {
      newSelected.add(photoId);
    }
    setSelectedPhotos(newSelected);
  };

  const selectAll = () => {
    if (selectedPhotos.size === photos.length) {
      setSelectedPhotos(new Set());
    } else {
      setSelectedPhotos(new Set(photos.map(p => p.id)));
    }
  };

  return (
    <div>
      <div className="mb-6 space-y-4">
        <div className="flex gap-4 flex-wrap">
          <label className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer">
            {uploading ? 'Uploading...' : 'Upload Single Photo'}
            <input
              type="file"
              accept="image/*"
              onChange={handleSingleUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>

          <label className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer">
            {uploading ? 'Uploading...' : 'Bulk Upload Photos'}
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleBulkUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>

          {photos.length > 0 && (
            <>
              <button
                onClick={selectAll}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                {selectedPhotos.size === photos.length ? 'Deselect All' : 'Select All'}
              </button>

              {selectedPhotos.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  disabled={deleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  {deleting ? 'Deleting...' : `Delete Selected (${selectedPhotos.size})`}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {photos.length === 0 ? (
        <p className="text-gray-500 text-center py-12">No photos uploaded yet</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {photos.map(photo => (
            <div
              key={photo.id}
              className={`relative border rounded-lg overflow-hidden ${selectedPhotos.has(photo.id) ? 'ring-4 ring-blue-500' : ''
                }`}
            >
              <div
                onClick={() => togglePhotoSelection(photo.id)}
                className="cursor-pointer"
              >
                <div className="relative w-full h-48 bg-gray-200">
                  <Image
                    src={photo.presignedUrl}
                    alt={photo.photographer || 'Photo'}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="absolute top-2 left-2">
                  <input
                    type="checkbox"
                    checked={selectedPhotos.has(photo.id)}
                    onChange={() => togglePhotoSelection(photo.id)}
                    className="w-5 h-5"
                  />
                </div>
              </div>

              <div className="p-3 bg-white">
                <p className="text-sm font-medium truncate">
                  {photo.photographer || 'Unknown'}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(photo.createdAt).toLocaleDateString()}
                </p>
                <button
                  onClick={() => handleDeletePhoto(photo.id)}
                  disabled={deleting}
                  className="mt-2 w-full px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {initialData.totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link
            href={`/?page=${initialData.page - 1}`}
            className={`px-4 py-2 rounded-lg ${initialData.page === 1
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed pointer-events-none'
                : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
          >
            Previous
          </Link>

          <span className="text-sm text-gray-700">
            Page {initialData.page} of {initialData.totalPages} ({initialData.total} total photos)
          </span>

          <Link
            href={`/?page=${initialData.page + 1}`}
            className={`px-4 py-2 rounded-lg ${initialData.page === initialData.totalPages
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed pointer-events-none'
                : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
          >
            Next
          </Link>
        </div>
      )}
    </div>
  );
}
