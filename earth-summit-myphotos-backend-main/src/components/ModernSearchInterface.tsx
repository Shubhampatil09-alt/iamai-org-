"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  Loader2,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { searchPhotosByFace } from "@/actions/search";

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

export default function ModernSearchInterface() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);

  const performSearch = async (file: File, page: number = 1) => {
    setSearching(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("page", page.toString());
      formData.append("limit", "50");

      const response = await searchPhotosByFace(formData);

      if (response.success && response.results && response.pagination) {
        setPagination(response.pagination);
        setResults(response.results.map((result) => ({
          ...result,
          presignedUrl: result.url,
        })));
      } else {
        alert(response.error || "Search failed");
      }
    } catch (error) {
      console.error("Search error:", error);
      alert("Search failed");
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
      {/* Upload Area */}
      <Card className={`p-8 transition-all`}>
        <div className="text-center space-y-4">
          {uploadedImage ? (
            <div className="space-y-4">
              <div className="relative w-64 h-64 mx-auto rounded-lg overflow-hidden border-2 border-primary">
                <Image
                  src={uploadedImage}
                  alt="Search query"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="flex flex-col items-center gap-2">
                <p className="text-sm font-medium">Search Image</p>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={searching}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Different Image
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <ImageIcon className="mx-auto h-16 w-16 text-muted-foreground" />
              <div>
                <h3 className="text-xl font-semibold mb-2">
                  Find Similar Photos
                </h3>
              </div>
              <Button
                size="lg"
                disabled={searching}
                onClick={() => fileInputRef.current?.click()}
              >
                {searching ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-5 w-5" />
                    Upload Photo to Search
                  </>
                )}
              </Button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleSearch}
            disabled={searching}
            className="hidden"
          />
        </div>
      </Card>

      {/* Results */}
      {searching && (
        <Card className="p-12 text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-lg font-medium">Analyzing image...</p>
          <p className="text-sm text-muted-foreground mt-2">
            This may take a few moments
          </p>
        </Card>
      )}

      {!searching && results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Similar Photos</h2>
            <Badge variant="secondary" className="text-sm px-3 py-1">
              {pagination?.total || 0} total{" "}
              {pagination?.total === 1 ? "result" : "results"}
            </Badge>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {results.map((result) => (
              <Card
                key={result.id}
                className="group overflow-hidden hover:shadow-lg transition-all"
              >
                <div className="aspect-square relative bg-muted">
                  {result.presignedUrl ? (
                    <Image
                      src={result.presignedUrl}
                      alt={result.photographer || "Photo"}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="p-3 space-y-1">
                  <p className="text-sm font-medium truncate">
                    {result.photographer || "Unknown"}
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        result.similarity > 0.8 ? "default" : "secondary"
                      }
                      className="text-xs"
                    >
                      {(result.similarity * 100).toFixed(1)}% match
                    </Badge>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={!pagination.hasPreviousPage || searching}
                onClick={() => handlePageChange(pagination.page - 1)}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
              </div>

              <Button
                variant="outline"
                size="sm"
                disabled={!pagination.hasNextPage || searching}
                onClick={() => handlePageChange(pagination.page + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
      )}

      {!searching && uploadedImage && results.length === 0 && (
        <Card className="p-12 text-center">
          <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            No similar photos found
          </h3>
          <p className="text-muted-foreground">
            Try uploading a different image
          </p>
        </Card>
      )}
    </div>
  );
}
