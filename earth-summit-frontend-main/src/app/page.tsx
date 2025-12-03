"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ViewState, Photo } from "@/types";
import { usePhotoSelection } from "@/hooks/usePhotoSelection";
import { usePhotoViewer } from "@/hooks/usePhotoViewer";
import { usePhotoDownload } from "@/hooks/usePhotoDownload";
import { usePhotoShare } from "@/hooks/usePhotoShare";
import { usePhotoSearch } from "@/hooks/usePhotoSearch";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { UploadView } from "@/components/views/UploadView";
import { ConfirmView } from "@/components/views/ConfirmView";
import { ResultsView } from "@/components/views/ResultsView";
import { uploadImageToS3 } from "./actions";
import config from "@/config/site-config.json";

export default function Home() {
  // View and upload state
  const [viewState, setViewState] = useState<ViewState>("upload");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [s3Key, setS3Key] = useState<string | null>(null);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);

  // Photos state
  const [selectedFilter, setSelectedFilter] = useState(config.resultsView.allFilterLabel);

  // Loading and error state
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(false);

  // Refs
  const observerTarget = useRef<HTMLDivElement>(null);

  // Use React Query for photo search with caching
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error: queryError,
  } = usePhotoSearch({
    s3Key,
    selectedFilter,
    enabled: viewState === "results",
  });

  // Flatten all pages into a single array
  const photos = data?.pages.flatMap((page) => page.results) ?? [];
  const totalFetched =
    data?.pages[data.pages.length - 1]?.pagination.totalFetched ?? 0;

  // Custom hooks
  const {
    selectedPhotos,
    handleImagePress,
    handleImageRelease,
    togglePhotoSelection,
    clearSelection,
  } = usePhotoSelection();

  const {
    viewingPhoto,
    viewingPhotoIndex,
    openPhotoViewer,
    closePhotoViewer,
    navigatePhoto,
  } = usePhotoViewer(photos);

  const {
    downloadingPhotoId,
    isBulkDownloading,
    handleDownloadSingle,
    handleDownloadSelected,
  } = usePhotoDownload();

  const { handleShareSingle } = usePhotoShare();

  // Use infinite scroll hook
  useInfiniteScroll(observerTarget, {
    enabled: viewState === "results",
    hasMore: hasNextPage ?? false,
    loading: isFetchingNextPage,
    onLoadMore: () => fetchNextPage(),
  });

  // Handle filter changes
  const handleFilterChange = useCallback(
    (newFilter: string) => {
      if (newFilter === selectedFilter) return;
      setSelectedFilter(newFilter);
      clearSelection();
    },
    [selectedFilter, clearSelection],
  );

  // Handle query errors
  useEffect(() => {
    if (isError && queryError) {
      const errorMessage = queryError instanceof Error ? queryError.message : "Unknown error";

      if (errorMessage === "No faces detected") {
        setSearchError(config.messages.noFacesDetected);
      } else {
        setSearchError(config.messages.genericError);
      }
      // Go back to confirm view to show error and allow retry
      setViewState("confirm");
    }
  }, [isError, queryError]);

  // File upload handlers
  const handleFileSelect = (file: File) => {
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setUploadedImage(result);
        setUploadedFile(file);
        setShowInstructionsModal(false);
        setViewState("confirm");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
      e.target.value = "";
    }
  };

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
      e.target.value = "";
    }
  };

  const handleUploadClick = () => {
    setShowInstructionsModal(true);
  };

  const handleConfirm = async () => {
    if (!uploadedFile) {
      setSearchError(config.messages.noFileSelected);
      return;
    }

    setIsInitialLoading(true);
    setSearchError(null);
    setUploadProgress(config.messages.preparing);

    try {
      setUploadProgress(config.messages.analyzing);
      setUploadProgress(config.messages.analyzing);

      const formData = new FormData();
      formData.append("file", uploadedFile);

      const { key } = await uploadImageToS3(formData);

      setUploadProgress(config.messages.processing);

      // Set the S3 key - React Query will automatically fetch
      setS3Key(key);
      setViewState("results");
      setUploadProgress(null);
    } catch (error) {
      console.error("Error fetching photos:", error);
      // Show specific user-facing errors like "No faces detected"
      // Otherwise show generic error message
      const errorMessage = error instanceof Error ? error.message : "";
      if (errorMessage === "No faces detected") {
        setSearchError(config.messages.noFacesDetected);
      } else {
        setSearchError(config.messages.genericError);
      }
      setUploadProgress(null);
    } finally {
      setIsInitialLoading(false);
    }
  };

  const handleImageClick = (
    photo: Photo,
    index: number,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    handleImageRelease();
    openPhotoViewer(photo, index);
  };

  const handleCloseModal = () => {
    setShowInstructionsModal(false);
  };

  const handleRetakeClick = () => {
    setShowInstructionsModal(true);
  };

  // Render views
  if (viewState === "upload") {
    return (
      <UploadView
        showInstructionsModal={showInstructionsModal}
        onUploadClick={handleUploadClick}
        onCloseModal={handleCloseModal}
        onFileSelect={handleInputChange}
        onCameraCapture={handleCameraCapture}
      />
    );
  }

  if (viewState === "confirm" && uploadedImage) {
    return (
      <ConfirmView
        uploadedImage={uploadedImage}
        loading={isInitialLoading}
        uploadProgress={uploadProgress}
        searchError={searchError}
        showInstructionsModal={showInstructionsModal}
        onConfirm={handleConfirm}
        onRetakeClick={handleRetakeClick}
        onCloseModal={handleCloseModal}
        onFileSelect={handleInputChange}
        onCameraCapture={handleCameraCapture}
      />
    );
  }

  return (
    <ResultsView
      photos={photos}
      availableDates={config.resultsView.availableDates}
      selectedFilter={selectedFilter}
      selectedPhotos={selectedPhotos}
      loading={isLoading || isFetchingNextPage}
      isFilterLoading={isLoading && !isFetchingNextPage}
      hasMore={hasNextPage ?? false}
      downloadingPhotoId={downloadingPhotoId}
      isBulkDownloading={isBulkDownloading}
      showInstructionsModal={showInstructionsModal}
      viewingPhoto={viewingPhoto}
      viewingPhotoIndex={viewingPhotoIndex}
      totalPhotos={totalFetched > 0 ? totalFetched : photos.length}
      observerTargetRef={observerTarget}
      onFilterChange={handleFilterChange}
      onBulkDownload={() =>
        handleDownloadSelected(
          photos,
          selectedPhotos,
          (error) => setSearchError(error),
          clearSelection,
        )
      }
      onClearSelection={clearSelection}
      onUploadClick={handleUploadClick}
      onImageClick={handleImageClick}
      onImagePress={handleImagePress}
      onImageRelease={handleImageRelease}
      onToggleSelection={togglePhotoSelection}
      onDownloadSingle={(photo) =>
        handleDownloadSingle(photo, (error) => setSearchError(error))
      }
      onCloseModal={handleCloseModal}
      onFileSelect={handleInputChange}
      onCameraCapture={handleCameraCapture}
      onClosePhotoViewer={closePhotoViewer}
      onNavigatePhoto={navigatePhoto}
      onSharePhoto={(photo) =>
        handleShareSingle(
          photo,
          (message) => {
            setSearchError(message);
            setTimeout(() => setSearchError(null), 3000);
          },
          (error) => {
            setSearchError(error);
            setTimeout(() => setSearchError(null), 3000);
          },
        )
      }
    />
  );
}
