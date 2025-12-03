import { useRef, useEffect, useState, useCallback } from "react";

interface WebcamCaptureProps {
    onCapture: (file: File) => void;
    onClose: () => void;
}

export function WebcamCapture({ onCapture, onClose }: WebcamCaptureProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let currentStream: MediaStream | null = null;

        async function startCamera() {
            try {
                currentStream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: "user" },
                    audio: false,
                });
                if (videoRef.current) {
                    videoRef.current.srcObject = currentStream;
                }
            } catch (err) {
                console.error("Error accessing camera:", err);
                setError("Could not access camera. Please ensure you have granted permission.");
            }
        }

        startCamera();

        return () => {
            if (currentStream) {
                currentStream.getTracks().forEach((track) => track.stop());
            }
        };
    }, []);

    const capture = useCallback(() => {
        if (videoRef.current) {
            const canvas = document.createElement("canvas");
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            const ctx = canvas.getContext("2d");
            if (ctx) {
                // Mirror the image if using user-facing camera (optional, but usually expected)
                // ctx.translate(canvas.width, 0);
                // ctx.scale(-1, 1);

                ctx.drawImage(videoRef.current, 0, 0);
                canvas.toBlob((blob) => {
                    if (blob) {
                        const file = new File([blob], "webcam-photo.jpg", { type: "image/jpeg" });
                        onCapture(file);
                    }
                }, "image/jpeg", 0.95);
            }
        }
    }, [onCapture]);

    return (
        <div className="flex flex-col items-center w-full bg-black rounded-2xl overflow-hidden relative aspect-[3/4]">
            {error ? (
                <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                    <p className="text-white mb-4">{error}</p>
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-white/20 text-white rounded-full hover:bg-white/30 transition-colors"
                    >
                        Close
                    </button>
                </div>
            ) : (
                <>
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                    />

                    <div className="absolute bottom-6 left-0 right-0 flex justify-center items-center gap-8">
                        <button
                            onClick={onClose}
                            className="p-4 bg-white/20 backdrop-blur-sm rounded-full text-white hover:bg-white/30 transition-colors"
                            aria-label="Cancel"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        <button
                            onClick={capture}
                            className="p-1 rounded-full border-4 border-white/30 hover:border-white/50 transition-colors"
                            aria-label="Take Photo"
                        >
                            <div className="w-16 h-16 bg-white rounded-full border-4 border-transparent"></div>
                        </button>

                        <div className="w-14"></div> {/* Spacer for balance */}
                    </div>
                </>
            )}
        </div>
    );
}
