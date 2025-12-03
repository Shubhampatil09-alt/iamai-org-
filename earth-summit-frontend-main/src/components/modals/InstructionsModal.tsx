import Image from "next/image";
import { useState, useEffect } from "react";
import { WebcamCapture } from "@/components/photos/WebcamCapture";

import config from "@/config/site-config.json";

interface InstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCameraCapture: (e: React.ChangeEvent<HTMLInputElement>) => void;
  modalId?: string;
}

export function InstructionsModal({
  isOpen,
  onClose,
  onFileSelect,
  onCameraCapture,
  modalId = "default",
}: InstructionsModalProps) {
  const [showWebcam, setShowWebcam] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const userAgent = typeof window.navigator === "undefined" ? "" : navigator.userAgent;
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
      setIsMobile(mobile);
    };
    checkMobile();
  }, []);

  // Reset webcam state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setShowWebcam(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTakePhotoClick = (e: React.MouseEvent) => {
    if (!isMobile) {
      e.preventDefault();
      setShowWebcam(true);
    }
  };

  const handleWebcamCapture = (file: File) => {
    // Create a synthetic event to match the expected interface
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);

    const event = {
      target: {
        files: dataTransfer.files,
        value: "" // Value is not strictly needed for the handler but good to have structure
      }
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    onCameraCapture(event);
    setShowWebcam(false);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl w-full max-w-md max-h-[90vh] overflow-y-auto pb-6 animate-slide-up relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors z-10"
          aria-label="Close"
        >
          <svg
            className="w-5 h-5 text-gray-600"
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

        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Modal content */}
        <div className="px-6">
          <h2 className="text-2xl font-bold text-center mb-4">
            {showWebcam ? "Take a Photo" : config.instructionsModal.heading}
          </h2>

          {showWebcam ? (
            <div className="mb-4">
              <WebcamCapture
                onCapture={handleWebcamCapture}
                onClose={() => setShowWebcam(false)}
              />
            </div>
          ) : (
            <>
              {/* Example image */}
              <div className="mb-4 flex justify-center">
                <Image
                  src={config.assets.exampleSelfie}
                  alt="Example selfie"
                  width={144}
                  height={168}
                  className="w-36 h-42 rounded-2xl object-cover"
                />
              </div>

              {/* Instructions list */}
              <div className="space-y-3 mb-4">
                {config.instructionsModal.instructions.map((instruction, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full border-2 border-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg
                        className="w-3 h-3 text-blue-600"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <p className="text-gray-700 text-sm">{instruction}</p>
                  </div>
                ))}
              </div>

              {/* Privacy notice */}
              <p className="text-gray-500 text-xs mb-4 leading-relaxed">
                {config.instructionsModal.privacyNotice}
              </p>

              {/* Hidden file inputs */}
              <input
                type="file"
                accept="image/*"
                onChange={onFileSelect}
                className="hidden"
                id={`file-upload-modal-${modalId}`}
              />
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={onCameraCapture}
                className="hidden"
                id={`camera-capture-modal-${modalId}`}
              />

              {/* Action buttons */}
              <div className="space-y-3">
                <label
                  htmlFor={`camera-capture-modal-${modalId}`}
                  onClick={handleTakePhotoClick}
                  className="flex items-center justify-center gap-2 w-full py-3.5 bg-blue-600 text-white font-semibold text-center rounded-2xl cursor-pointer hover:bg-blue-700 transition-colors"
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
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  {config.instructionsModal.takePhotoButton}
                </label>

                <label
                  htmlFor={`file-upload-modal-${modalId}`}
                  className="flex items-center justify-center gap-2 w-full py-3.5 bg-white text-blue-600 font-semibold text-center rounded-2xl cursor-pointer border-2 border-blue-600 hover:bg-blue-50 transition-colors"
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
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  {config.instructionsModal.galleryButton}
                </label>

                <button
                  onClick={onClose}
                  className="w-full py-2 text-gray-500 text-sm"
                >
                  {config.instructionsModal.cancelButton}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
