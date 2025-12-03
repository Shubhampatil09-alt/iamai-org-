'use client';

import { useState } from 'react';
import Image from 'next/image';

type SearchResult = {
  id: string;
  photographer: string | null;
  metadata: any;
  similarity: number;
  matchCount: number;
  presignedUrl?: string;
};

type PaginationInfo = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export default function SearchInterface() {
  const [searching, setSearching] = useState(false);
  const [loadingImages, setLoadingImages] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);

  const fetchPresignedUrls = async (photoIds: string[]) => {
    const apiKey = process.env.NEXT_PUBLIC_API_KEY;
    if (!apiKey) {
      console.error('API key not configured');
      return {};
    }

    const urlPromises = photoIds.map(async (id) => {
      try {
        const response = await fetch(`/api/photos/${id}`, {
          headers: {
            'x-api-key': apiKey,
          },
        });
        if (response.ok) {
          const data = await response.json();
          return { id, url: data.presignedUrl };
        }
      } catch (error) {
        console.error(`Failed to fetch URL for ${id}:`, error);
      }
      return { id, url: null };
    });

    const urls = await Promise.all(urlPromises);
    return urls.reduce((acc, { id, url }) => {
      if (url) acc[id] = url;
      return acc;
    }, {} as Record<string, string>);
  };

  const performSearch = async (file: File, page: number = 1) => {
    const apiKey = process.env.NEXT_PUBLIC_API_KEY;
    if (!apiKey) {
      alert('API key not configured');
      return;
    }

    setSearching(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('page', page.toString());
    formData.append('limit', '20');

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
        },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setPagination(data.pagination);

        // Fetch presigned URLs for the results
        setLoadingImages(true);
        const photoIds = data.results.map((r: SearchResult) => r.id);
        const presignedUrls = await fetchPresignedUrls(photoIds);

        // Merge presigned URLs with results
        const resultsWithUrls = data.results.map((result: SearchResult) => ({
          ...result,
          presignedUrl: presignedUrls[result.id],
        }));

        setResults(resultsWithUrls);
        setLoadingImages(false);
      } else {
        alert('Search failed');
      }
    } catch (error) {
      console.error('Search error:', error);
      alert('Search failed');
    } finally {
      setSearching(false);
    }
  };

  const handleSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    setUploadedFile(file);

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadedImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    await performSearch(file, 1);
  };

  const handlePageChange = async (newPage: number) => {
    if (!uploadedFile) return;
    await performSearch(uploadedFile, newPage);
  };

  return (
    <div className="space-y-8">
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
        <label className="cursor-pointer">
          <div className="space-y-4">
            <div className="text-gray-600">
              {searching ? (
                <p className="text-lg">Searching...</p>
              ) : uploadedImage ? (
                <div className="space-y-4">
                  <p className="text-lg font-medium">Search Image:</p>
                  <div className="relative w-64 h-64 mx-auto">
                    <Image
                      src={uploadedImage}
                      alt="Search query"
                      fill
                      className="object-cover rounded-lg"
                    />
                  </div>
                  <p className="text-sm text-blue-600">Click to upload a different image</p>
                </div>
              ) : (
                <>
                  <p className="text-lg">Upload a photo to find similar images</p>
                  <p className="text-sm">Click or drag to upload</p>
                </>
              )}
            </div>
          </div>
          <input
            type="file"
            accept="image/*"
            onChange={handleSearch}
            disabled={searching}
            className="hidden"
          />
        </label>
      </div>

      {loadingImages && (
        <div className="text-center py-12">
          <p className="text-lg">Loading images...</p>
        </div>
      )}

      {!loadingImages && results.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">
            Similar Photos ({pagination?.total || results.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {results.map((result) => (
              <div key={result.id} className="border rounded-lg overflow-hidden">
                <div className="relative w-full h-48 bg-gray-200">
                  {result.presignedUrl ? (
                    <Image
                      src={result.presignedUrl}
                      alt={result.photographer || 'Photo'}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <p className="text-sm text-gray-500">Loading...</p>
                    </div>
                  )}
                </div>
                <div className="p-3 bg-white">
                  <p className="text-sm font-medium truncate">
                    {result.photographer || 'Unknown'}
                  </p>
                  <p className="text-xs text-gray-500">
                    Match: {(result.similarity * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            ))}
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-4">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={!pagination.hasPreviousPage || searching}
                className="px-4 py-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={!pagination.hasNextPage || searching}
                className="px-4 py-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {!searching && results.length === 0 && uploadedImage && (
        <div className="text-center text-gray-500 py-12">
          <p>No similar photos found</p>
        </div>
      )}
    </div>
  );
}
