interface LoadingSpinnerProps {
  message?: string;
  size?: "sm" | "md" | "lg";
  color?: "blue" | "white";
}

export function LoadingSpinner({
  message,
  size = "md",
  color = "blue",
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "w-2 h-2",
    md: "w-3 h-3",
    lg: "w-4 h-4",
  };

  const colorClasses = {
    blue: "bg-blue-600",
    white: "bg-white",
  };

  const dotClass = `${sizeClasses[size]} ${colorClasses[color]} rounded-full animate-bounce`;

  return (
    <div className="flex flex-col items-center justify-center py-8 gap-4">
      <div className="flex gap-2">
        <div className={dotClass} style={{ animationDelay: "0ms" }} />
        <div className={dotClass} style={{ animationDelay: "150ms" }} />
        <div className={dotClass} style={{ animationDelay: "300ms" }} />
      </div>
      {message && (
        <p
          className={`text-sm ${color === "white" ? "text-white" : "text-gray-600"}`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
