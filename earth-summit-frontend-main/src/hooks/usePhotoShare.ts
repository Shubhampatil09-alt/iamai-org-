import { Photo } from "@/types";
import config from "@/config/site-config.json";

export function usePhotoShare() {
  const handleShareSingle = async (
    photo: Photo,
    onSuccess?: (message: string) => void,
    onError?: (error: string) => void
  ) => {
    try {
      // Create shareable URL
      const shareUrl = `${window.location.origin}/view/${photo.id}`;

      // Check if Web Share API is available
      if (navigator.share) {
        await navigator.share({
          title: config.hooks.shareTitle,
          text: config.hooks.shareText,
          url: shareUrl,
        });
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        // Fallback: copy URL to clipboard
        await navigator.clipboard.writeText(shareUrl);
        onSuccess?.(config.hooks.linkCopied);
      } else {
        // Final fallback: create a temporary input to copy
        const textArea = document.createElement("textarea");
        textArea.value = shareUrl;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand("copy");
          onSuccess?.(config.hooks.linkCopied);
        } catch {
          onError?.(config.hooks.genericError);
        }
        document.body.removeChild(textArea);
      }
    } catch (error) {
      console.error("Error sharing photo:", error);
      if ((error as Error).name !== "AbortError") {
        onError?.(config.hooks.genericError);
      }
    }
  };

  return {
    handleShareSingle,
  };
}
