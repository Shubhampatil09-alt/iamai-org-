import config from "@/config/site-config.json";

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  onUploadClick?: () => void;
  leftContent?: React.ReactNode;
  showUploadButton?: boolean;
  variant?: "default" | "transparent";
}

export function AppHeader({
  title = config.app.title,
  subtitle = config.app.subtitle,
  onUploadClick,
  leftContent,
  showUploadButton = false,
  variant = "default",
}: AppHeaderProps) {
  const headerClasses =
    variant === "transparent"
      ? "bg-white/80 backdrop-blur-sm border-b border-gray-100"
      : "bg-white";

  return (
    <header
      className={`${headerClasses} px-4 py-3 md:py-4 flex items-center justify-between sticky top-0 z-20 transition-all duration-200`}
    >
      <div className="flex-shrink-0 w-10 md:w-16">
        {leftContent}
      </div>

      <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
        <img
          src={config.assets.logo}
          alt={config.assets.logoAlt}
          className="h-8 md:h-14 w-auto object-contain max-w-[160px] md:max-w-none"
        />

        {/* Vertical Divider */}
        <div className="h-8 w-px bg-gray-200 mx-1 hidden md:block" />

        <div className="flex flex-col items-start shrink-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 md:px-2.5 py-0.5 rounded-full text-[10px] md:text-xs font-medium bg-blue-100 text-blue-800 whitespace-nowrap border border-blue-200">
              {title}
            </span>
          </div>
          {subtitle && (
            <p
              className={`text-[10px] md:text-xs font-medium mt-0.5 ${variant === "transparent" ? "text-blue-600" : "text-gray-500"
                }`}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="flex-shrink-0 flex justify-end ml-4">
        {showUploadButton && (
          <button
            onClick={onUploadClick}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors group"
            aria-label="Upload new photo"
            title="Upload new photo"
          >
            <svg
              className="w-6 h-6 md:w-7 md:h-7 text-gray-600 group-hover:text-blue-600 transition-colors"
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
        )}
      </div>
    </header>
  );
}
