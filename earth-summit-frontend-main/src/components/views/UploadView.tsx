import { InstructionsModal } from "@/components/modals/InstructionsModal";
import config from "@/config/site-config.json";

interface UploadViewProps {
  showInstructionsModal: boolean;
  onUploadClick: () => void;
  onCloseModal: () => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCameraCapture: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function UploadView({
  showInstructionsModal,
  onUploadClick,
  onCloseModal,
  onFileSelect,
  onCameraCapture,
}: UploadViewProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex flex-col relative">


      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
        <div className="w-full max-w-md mx-auto flex flex-col items-center">
          {/* GFF Logo */}
          <div className="mb-8 animate-fade-in">
            <img
              src={config.assets.logo}
              alt={config.assets.logoAlt}
              className="h-24 mx-auto"
            />
          </div>

          {/* Welcome heading with fade-in animation */}
          <div className="text-center mb-6 sm:mb-8 animate-fade-in animation-delay-200 px-4">
            <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 mb-3 sm:mb-4">
              {config.uploadView.heading}
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-gray-600 mb-6 sm:mb-8">
              {config.uploadView.subheading}
            </p>
          </div>

          {/* CTA Button */}
          <div className="w-full animate-fade-in animation-delay-400">
            <button
              onClick={onUploadClick}
              className="block w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold text-center rounded-2xl cursor-pointer hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl transform hover:scale-[1.02] mb-4"
            >
              {config.uploadView.buttonText}
            </button>

            {/* Microtext */}
            <p className="text-xs text-gray-500 text-center px-4">
              {config.uploadView.microtext}
            </p>
          </div>
        </div>
      </main>

      {/* Instructions Modal */}
      <InstructionsModal
        isOpen={showInstructionsModal}
        onClose={onCloseModal}
        onFileSelect={onFileSelect}
        onCameraCapture={onCameraCapture}
        modalId="upload"
      />
    </div>
  );
}
