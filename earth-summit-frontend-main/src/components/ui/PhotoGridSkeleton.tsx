export function PhotoGridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mb-6">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="relative aspect-square bg-gray-200 rounded-lg overflow-hidden animate-pulse"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-shimmer" />
        </div>
      ))}
    </div>
  );
}
