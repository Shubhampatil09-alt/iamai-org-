import { Photo } from "@/types";
import { AppHeader } from "@/components/ui/AppHeader";
import { DateFilterBar } from "@/components/photos/DateFilterBar";
import { PhotoCard } from "@/components/photos/PhotoCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { PhotoGridSkeleton } from "@/components/ui/PhotoGridSkeleton";
import { PhotoViewer } from "@/components/modals/PhotoViewer";
import { InstructionsModal } from "@/components/modals/InstructionsModal";

import config from "@/config/site-config.json";

interface ResultsViewProps {
  photos: Photo[];
  availableDates: string[];
  selectedFilter: string;
  selectedPhotos: Set<string>;
  loading: boolean;
  isFilterLoading: boolean;
  hasMore: boolean;
  downloadingPhotoId: string | null;
  isBulkDownloading: boolean;
  showInstructionsModal: boolean;
  viewingPhoto: Photo | null;
  viewingPhotoIndex: number;
  totalPhotos: number;
  observerTargetRef: React.RefObject<HTMLDivElement | null>;
  onFilterChange: (filter: string) => void;
  onBulkDownload: () => void;
  onClearSelection: () => void;
  onUploadClick: () => void;
  onImageClick: (photo: Photo, index: number, e: React.MouseEvent) => void;
  onImagePress: (photoId: string, e: React.MouseEvent | React.TouchEvent) => void;
  onImageRelease: () => void;
  onToggleSelection: (photoId: string) => void;
  onDownloadSingle: (photo: Photo) => void;
  onCloseModal: () => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCameraCapture: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClosePhotoViewer: () => void;
  onNavigatePhoto: (direction: "prev" | "next") => void;
  onSharePhoto: (photo: Photo) => void;
}

export function ResultsView({
  photos,
  availableDates,
  selectedFilter,
  selectedPhotos,
  loading,
  isFilterLoading,
  hasMore,
  downloadingPhotoId,
  isBulkDownloading,
  showInstructionsModal,
  viewingPhoto,
  viewingPhotoIndex,
  totalPhotos,
  observerTargetRef,
  onFilterChange,
  onBulkDownload,
  onClearSelection,
  onUploadClick,
  onImageClick,
  onImagePress,
  onImageRelease,
  onToggleSelection,
  onDownloadSingle,
  onCloseModal,
  onFileSelect,
  onCameraCapture,
  onClosePhotoViewer,
  onNavigatePhoto,
  onSharePhoto,
}: ResultsViewProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AppHeader
        title={config.app.title}
        subtitle={config.app.subtitle}
        showUploadButton
        onUploadClick={onUploadClick}
      />

      <DateFilterBar
        availableDates={availableDates}
        selectedFilter={selectedFilter}
        selectedPhotosCount={selectedPhotos.size}
        isBulkDownloading={isBulkDownloading}
        onFilterChange={onFilterChange}
        onBulkDownload={onBulkDownload}
        onClearSelection={onClearSelection}
      />

      <main className="flex-1 px-4 pt-4 pb-6">
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-gray-900">
            {selectedFilter === config.resultsView.allFilterLabel ? config.resultsView.allPhotosHeading : selectedFilter}
          </h2>
        </div>

        {isFilterLoading ? (
          <PhotoGridSkeleton />
        ) : photos.length === 0 && !loading ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg">
              {selectedFilter === config.resultsView.allFilterLabel
                ? config.resultsView.noImagesFound
                : config.resultsView.noImagesFoundForFilter.replace("{filter}", selectedFilter)}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mb-6">
              {photos.map((photo, index) => (
                <PhotoCard
                  key={`${photo.id}-${index}`}
                  photo={photo}
                  index={index}
                  isSelected={selectedPhotos.has(photo.id)}
                  isDownloading={downloadingPhotoId === photo.id}
                  onImageClick={onImageClick}
                  onImagePress={onImagePress}
                  onImageRelease={onImageRelease}
                  onToggleSelection={onToggleSelection}
                  onDownload={onDownloadSingle}
                />
              ))}
            </div>

            {loading && !isFilterLoading && <LoadingSpinner />}

            <div ref={observerTargetRef} className="h-10" />

            {!hasMore && photos.length > 0 && (
              <div className="text-center py-8 text-gray-500">
                <p>{config.resultsView.noMorePhotos}</p>
              </div>
            )}
          </>
        )}
      </main>

      {/* Photo Viewer Modal */}
      {viewingPhoto && (
        <PhotoViewer
          photo={viewingPhoto}
          photoIndex={viewingPhotoIndex}
          totalPhotos={totalPhotos}
          onClose={onClosePhotoViewer}
          onNavigate={onNavigatePhoto}
          onDownload={onDownloadSingle}
          onShare={onSharePhoto}
          downloadingPhotoId={downloadingPhotoId}
          canNavigatePrev={viewingPhotoIndex > 0}
          canNavigateNext={viewingPhotoIndex < photos.length - 1}
        />
      )}

      {/* Instructions Modal */}
      <InstructionsModal
        isOpen={showInstructionsModal}
        onClose={onCloseModal}
        onFileSelect={onFileSelect}
        onCameraCapture={onCameraCapture}
        modalId="results"
      />
    </div>
  );
}
