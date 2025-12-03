import { AppHeader } from "@/components/ui/AppHeader";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { InstructionsModal } from "@/components/modals/InstructionsModal";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

import config from "@/config/site-config.json";

interface ConfirmViewProps {
  uploadedImage: string;
  loading: boolean;
  uploadProgress: string | null;
  searchError: string | null;
  showInstructionsModal: boolean;
  onConfirm: () => void;
  onRetakeClick: () => void;
  onCloseModal: () => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCameraCapture: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function ConfirmView({
  uploadedImage,
  loading,
  uploadProgress,
  searchError,
  showInstructionsModal,
  onConfirm,
  onRetakeClick,
  onCloseModal,
  onFileSelect,
  onCameraCapture,
}: ConfirmViewProps) {
  return (
    <div className="h-screen bg-[#F5F5F9] flex flex-col justify-between relative">
      <AppHeader
        title={config.app.title}
        subtitle={config.app.subtitle}
        variant="transparent"
      />

      <div className="flex items-center justify-center px-6">
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={uploadedImage}
            alt="Uploaded preview"
            className="w-64 h-auto rounded-3xl shadow-lg object-contain"
          />
          <button
            className="absolute bottom-4 right-4 bg-white rounded-full p-3 shadow-lg hover:bg-gray-50 transition-colors disabled:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Retake photo"
            onClick={onRetakeClick}
            disabled={loading}
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
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
        </div>
      </div>

      <div className="px-6 pb-8">
        <div className="max-w-md mx-auto space-y-3">
          <ErrorBanner message={searchError} />
          {!loading && (
            <button
              onClick={onRetakeClick}
              className="w-full py-4 text-blue-600 font-semibold text-center bg-white rounded-2xl transition-colors hover:bg-gray-50"
            >
              {config.confirmView.retakeButton}
            </button>
          )}
          <button
            onClick={onConfirm}
            className="w-full py-4 bg-blue-600 text-white font-semibold rounded-2xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {loading ? uploadProgress || config.confirmView.searchingButton : config.confirmView.searchButton}
          </button>
        </div>
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="flex flex-col items-center p-6">
            <LoadingSpinner size="lg" />
            <p className="mt-4 text-lg font-medium text-gray-900 animate-pulse">
              {uploadProgress || config.confirmView.searchingButton}
            </p>
          </div>
        </div>
      )}

      {/* Instructions Modal */}
      <InstructionsModal
        isOpen={showInstructionsModal}
        onClose={onCloseModal}
        onFileSelect={onFileSelect}
        onCameraCapture={onCameraCapture}
        modalId="confirm"
      />
    </div>
  );
}
