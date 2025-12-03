import Image from "next/image";
import { Photo } from "@/types";
import { formatDate } from "@/utils/formatDate";
import config from "@/config/site-config.json";

interface PhotoViewerProps {
  photo: Photo | null;
  photoIndex: number;
  totalPhotos: number;
  onClose: () => void;
  onNavigate: (direction: "prev" | "next") => void;
  onDownload: (photo: Photo) => void;
  onShare: (photo: Photo) => void;
  downloadingPhotoId: string | null;
  canNavigatePrev: boolean;
  canNavigateNext: boolean;
}

export function PhotoViewer({
  photo,
  photoIndex,
  totalPhotos,
  onClose,
  onNavigate,
  onDownload,
  onShare,
  downloadingPhotoId,
  canNavigatePrev,
  canNavigateNext,
}: PhotoViewerProps) {
  if (!photo) return null;

  return (
    <div
      className="fixed inset-0 bg-black z-50 flex flex-col"
      onClick={onClose}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/80 backdrop-blur-sm">
        <button
          onClick={onClose}
          className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
          aria-label="Close viewer"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onShare(photo);
            }}
            className="px-4 py-2 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors flex items-center gap-2"
            aria-label="Share photo"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
            {config.photoViewer.shareButton}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDownload(photo);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
            aria-label="Download photo"
            disabled={downloadingPhotoId === photo.id}
          >
            <svg
              className={`w-5 h-5 ${downloadingPhotoId === photo.id ? "animate-bounce" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            {config.photoViewer.downloadButton}
          </button>
        </div>
      </div>

      {/* Image Container */}
      <div
        className="flex-1 flex items-center justify-center relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Previous button */}
        {canNavigatePrev && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNavigate("prev");
            }}
            className="absolute left-4 p-3 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors z-10"
            aria-label="Previous photo"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
        )}

        {/* Image */}
        <div className="relative w-full h-full flex items-center justify-center">
          <Image
            src={photo.url}
            alt={`Photo ${photo.id}`}
            width={1920}
            height={1080}
            className="max-h-full max-w-full object-contain"
            style={{ width: "auto", height: "auto" }}
            unoptimized
          />
        </div>

        {/* Next button */}
        {canNavigateNext && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNavigate("next");
            }}
            className="absolute right-4 p-3 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors z-10"
            aria-label="Next photo"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Photo Info */}
      <div className="p-4 bg-black/80 backdrop-blur-sm text-white">
        <p className="text-sm text-gray-300">
          {config.photoViewer.photoCount
            .replace("{index}", (photoIndex + 1).toString())
            .replace("{total}", totalPhotos.toString())}
        </p>
        {photo.capturedAt && (
          <p className="text-xs text-gray-400 mt-1">
            {config.photoViewer.capturedOn.replace("{date}", formatDate(photo.capturedAt))}
          </p>
        )}
      </div>
    </div>
  );
}
