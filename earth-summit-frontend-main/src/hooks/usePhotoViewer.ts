import { useState, useEffect, useCallback } from "react";
import { Photo } from "@/types";

export function usePhotoViewer(photos: Photo[]) {
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);
  const [viewingPhotoIndex, setViewingPhotoIndex] = useState<number>(-1);

  const openPhotoViewer = (photo: Photo, index: number) => {
    setViewingPhoto(photo);
    setViewingPhotoIndex(index);
  };

  const closePhotoViewer = () => {
    setViewingPhoto(null);
    setViewingPhotoIndex(-1);
  };

  const navigatePhoto = useCallback(
    (direction: "prev" | "next") => {
      if (direction === "prev" && viewingPhotoIndex > 0) {
        const newIndex = viewingPhotoIndex - 1;
        setViewingPhotoIndex(newIndex);
        setViewingPhoto(photos[newIndex]);
      } else if (
        direction === "next" &&
        viewingPhotoIndex < photos.length - 1
      ) {
        const newIndex = viewingPhotoIndex + 1;
        setViewingPhotoIndex(newIndex);
        setViewingPhoto(photos[newIndex]);
      }
    },
    [viewingPhotoIndex, photos],
  );

  // Preload adjacent images for smooth navigation
  useEffect(() => {
    if (viewingPhotoIndex === -1 || !viewingPhoto) return;

    const preloadImage = (url: string) => {
      const img = new window.Image();
      img.src = url;
    };

    // Preload next image
    if (viewingPhotoIndex < photos.length - 1) {
      preloadImage(photos[viewingPhotoIndex + 1].url);
    }

    // Preload previous image
    if (viewingPhotoIndex > 0) {
      preloadImage(photos[viewingPhotoIndex - 1].url);
    }
  }, [viewingPhotoIndex, viewingPhoto, photos]);

  // Keyboard navigation for gallery
  useEffect(() => {
    if (!viewingPhoto) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        navigatePhoto("prev");
      } else if (e.key === "ArrowRight") {
        navigatePhoto("next");
      } else if (e.key === "Escape") {
        closePhotoViewer();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [viewingPhoto, navigatePhoto]);

  return {
    viewingPhoto,
    viewingPhotoIndex,
    openPhotoViewer,
    closePhotoViewer,
    navigatePhoto,
  };
}
