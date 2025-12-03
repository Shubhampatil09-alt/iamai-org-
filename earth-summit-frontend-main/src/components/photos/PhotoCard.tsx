import Image from "next/image";
import { Photo } from "@/types";

interface PhotoCardProps {
  photo: Photo;
  index: number;
  isSelected: boolean;
  isDownloading: boolean;
  onImageClick: (photo: Photo, index: number, e: React.MouseEvent) => void;
  onImagePress: (photoId: string, e: React.MouseEvent | React.TouchEvent) => void;
  onImageRelease: () => void;
  onToggleSelection: (photoId: string) => void;
  onDownload: (photo: Photo) => void;
}

export function PhotoCard({
  photo,
  index,
  isSelected,
  isDownloading,
  onImageClick,
  onImagePress,
  onImageRelease,
  onToggleSelection,
  onDownload,
}: PhotoCardProps) {
  return (
    <div
      key={`${photo.id}-${index}`}
      className="relative aspect-square bg-gray-200 rounded-2xl overflow-hidden group"
    >
      <Image
        src={photo.url}
        alt={`Photo ${photo.id}`}
        fill
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
        className="object-cover cursor-pointer"
        loading="lazy"
        priority={false}
        quality={75}
        onClick={(e) => onImageClick(photo, index, e)}
        onMouseDown={(e) => onImagePress(photo.id, e)}
        onMouseUp={onImageRelease}
        onMouseLeave={onImageRelease}
        onTouchStart={(e) => onImagePress(photo.id, e)}
        onTouchEnd={onImageRelease}
        onTouchCancel={onImageRelease}
      />

      {/* Selection checkbox */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelection(photo.id);
        }}
        className={`absolute top-2 left-2 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center transition-all ${isSelected
            ? "bg-blue-600 hover:bg-blue-700"
            : "bg-black/20 hover:bg-black/30"
          }`}
        aria-label="Select photo"
      >
        {isSelected && (
          <svg
            className="w-4 h-4 text-white"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </button>

      {/* Download button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDownload(photo);
        }}
        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center hover:bg-blue-700 transition-all shadow-lg disabled:opacity-50"
        aria-label="Download photo"
        disabled={isDownloading}
      >
        <svg
          className={`w-4 h-4 text-white ${isDownloading ? "animate-bounce" : ""}`}
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
      </button>
    </div>
  );
}
