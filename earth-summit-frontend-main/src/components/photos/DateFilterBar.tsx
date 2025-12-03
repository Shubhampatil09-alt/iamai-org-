interface DateFilterBarProps {
  availableDates: string[];
  selectedFilter: string;
  selectedPhotosCount: number;
  isBulkDownloading: boolean;
  onFilterChange: (filter: string) => void;
  onBulkDownload: () => void;
  onClearSelection: () => void;
}

export function DateFilterBar({
  availableDates,
  selectedFilter,
  selectedPhotosCount,
  isBulkDownloading,
  onFilterChange,
  onBulkDownload,
  onClearSelection,
}: DateFilterBarProps) {
  return (
    <div className="bg-white px-4 py-3 sticky top-[64px] md:top-[88px] z-10 transition-[top] duration-200">
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide flex-1">
          {availableDates.map((filter) => (
            <button
              key={filter}
              onClick={() => onFilterChange(filter)}
              className={`px-5 py-2.5 rounded-full whitespace-nowrap font-medium transition-colors text-sm flex-shrink-0 ${selectedFilter === filter
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-white text-gray-700 border border-gray-200"
                }`}
            >
              {filter}
            </button>
          ))}
        </div>
        {selectedPhotosCount > 0 && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={onBulkDownload}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-full hover:bg-blue-700 transition-colors disabled:opacity-50"
              disabled={isBulkDownloading}
            >
              <svg
                className={`w-4 h-4 ${isBulkDownloading ? "animate-bounce" : ""}`}
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
              {selectedPhotosCount}
            </button>
            <button
              onClick={onClearSelection}
              className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
              aria-label="Clear selection"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
