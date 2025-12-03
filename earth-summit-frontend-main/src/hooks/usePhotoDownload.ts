import { useState } from "react";
import { Photo } from "@/types";
import config from "@/config/site-config.json";

export function usePhotoDownload() {
  const [downloadingPhotoId, setDownloadingPhotoId] = useState<string | null>(
    null
  );
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);

  const handleDownloadSingle = async (
    photo: Photo,
    onError?: (error: string) => void
  ) => {
    try {
      setDownloadingPhotoId(photo.id);

      const response = await fetch(photo.url, {
        mode: "cors",
        cache: "no-cache",
        credentials: "omit",
      });
      if (!response.ok) {
        throw new Error(`Failed to download photo: ${response.status}`);
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `photo-${photo.id}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Error downloading photo:", error);
      onError?.(config.hooks.genericError);
    } finally {
      setDownloadingPhotoId(null);
    }
  };

  const handleDownloadSelected = async (
    photos: Photo[],
    selectedPhotoIds: Set<string>,
    onError?: (error: string) => void,
    onComplete?: () => void
  ) => {
    if (selectedPhotoIds.size === 0) return;

    setIsBulkDownloading(true);
    try {
      // Download each selected photo with a delay
      const selectedPhotosArray = photos.filter((photo) =>
        selectedPhotoIds.has(photo.id)
      );
      for (let i = 0; i < selectedPhotosArray.length; i++) {
        await handleDownloadSingle(selectedPhotosArray[i], onError);
        // Add a small delay between downloads
        if (i < selectedPhotosArray.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
      onComplete?.();
    } catch (error) {
      console.error("Error downloading selected photos:", error);
      onError?.(config.hooks.genericError);
    } finally {
      setIsBulkDownloading(false);
    }
  };

  return {
    downloadingPhotoId,
    isBulkDownloading,
    handleDownloadSingle,
    handleDownloadSelected,
  };
}
