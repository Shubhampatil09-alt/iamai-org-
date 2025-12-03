import { useState, useCallback } from "react";

export function usePhotoSelection() {
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(
    null,
  );

  const togglePhotoSelection = useCallback((photoId: string) => {
    setSelectedPhotos((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(photoId)) {
        newSet.delete(photoId);
      } else {
        newSet.add(photoId);
      }
      return newSet;
    });
  }, []);

  const handleImagePress = useCallback((
    photoId: string,
    e: React.MouseEvent | React.TouchEvent,
  ) => {
    e.stopPropagation();
    const timer = setTimeout(() => {
      togglePhotoSelection(photoId);
    }, 500); // 500ms long press
    setLongPressTimer(timer);
  }, [togglePhotoSelection]);

  const handleImageRelease = useCallback(() => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  }, [longPressTimer]);

  const clearSelection = useCallback(() => {
    setSelectedPhotos(new Set());
  }, []);

  return {
    selectedPhotos,
    setSelectedPhotos,
    togglePhotoSelection,
    handleImagePress,
    handleImageRelease,
    clearSelection,
  };
}
