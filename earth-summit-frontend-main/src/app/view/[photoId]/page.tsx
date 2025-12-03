"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { getPresignedUrl } from "../../actions";
import { useParams } from "next/navigation";

export default function ViewPhoto() {
  const params = useParams();
  const photoId = params.photoId as string;

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    async function loadImage() {
      if (!photoId) {
        setError("Invalid photo ID");
        setLoading(false);
        return;
      }

      try {
        const { url } = await getPresignedUrl(photoId);
        setImageUrl(url);
      } catch (err) {
        console.error("Error loading image:", err);
        setError("Failed to load image. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    loadImage();
  }, [photoId]);

  const handleDownload = async () => {
    if (!photoId || !imageUrl) return;

    try {
      setIsDownloading(true);

      // Fetch the image directly from the presigned URL
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to download photo: ${response.status}`);
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `photo-${photoId}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Error downloading photo:", error);
      setShareError("Failed to download photo.");
      setTimeout(() => setShareError(null), 3000);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShare = async () => {
    if (!photoId) return;

    try {
      // Try to share the URL first
      const shareUrl = `${window.location.origin}/view/${photoId}`;

      if (navigator.share) {
        await navigator.share({
          title: "MyPhotos - Powered by GFFGPT",
          text: "Check out this photo!",
          url: shareUrl,
        });
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        // Fallback: copy URL to clipboard
        await navigator.clipboard.writeText(shareUrl);
        setShareError("Link copied to clipboard!");
        setTimeout(() => setShareError(null), 3000);
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
          setShareError("Link copied to clipboard!");
          setTimeout(() => setShareError(null), 3000);
        } catch {
          setShareError("Unable to share. Please copy the URL manually.");
          setTimeout(() => setShareError(null), 3000);
        }
        document.body.removeChild(textArea);
      }
    } catch (error) {
      console.error("Error sharing photo:", error);
      if ((error as Error).name !== "AbortError") {
        setShareError("Failed to share photo.");
        setTimeout(() => setShareError(null), 3000);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-2">
            <div
              className="w-3 h-3 bg-blue-600 rounded-full animate-bounce"
              style={{ animationDelay: "0ms" }}
            />
            <div
              className="w-3 h-3 bg-blue-600 rounded-full animate-bounce"
              style={{ animationDelay: "150ms" }}
            />
            <div
              className="w-3 h-3 bg-blue-600 rounded-full animate-bounce"
              style={{ animationDelay: "300ms" }}
            />
          </div>
          <p className="text-gray-600">Loading photo...</p>
        </div>
      </div>
    );
  }

  if (error || !imageUrl) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="max-w-md mx-auto text-center">
          <div className="w-20 h-20 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
            <svg
              className="w-10 h-10 text-red-600"
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
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Photo Not Found
          </h1>
          <p className="text-gray-600 mb-6">
            {error || "This photo could not be loaded."}
          </p>
          <button
            onClick={() => (window.location.href = "/")}
            className="inline-block px-6 py-3 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700 transition-colors"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white px-4 py-4 shadow-sm">
        <div className="max-w-3xl mx-auto flex items-center justify-center">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">My Photos</h1>
            <p className="text-xs text-blue-600 font-medium">
              Powered by GFFGPT
            </p>
          </div>
        </div>
      </header>

      {/* Error/Success Message */}
      {shareError && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-3">
          <div className="max-w-4xl mx-auto">
            <p className="text-blue-800 text-sm text-center">{shareError}</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-4xl">
          {/* Image Container */}
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-6 relative">
            <Image
              src={imageUrl}
              alt={`Photo ${photoId}`}
              width={1920}
              height={1080}
              className="w-full h-auto object-contain max-h-[70vh]"
              style={{ width: "100%", height: "auto" }}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleShare}
              className="flex items-center gap-2 px-6 py-3 bg-white text-gray-900 font-semibold rounded-full border-2 border-gray-300 hover:border-blue-600 hover:text-blue-600 transition-colors shadow-sm"
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
              Share
            </button>
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDownloading ? (
                <>
                  <svg
                    className="w-5 h-5 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Downloading...
                </>
              ) : (
                <>
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
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  Download
                </>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
