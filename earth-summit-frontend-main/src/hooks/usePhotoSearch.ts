import { useInfiniteQuery } from "@tanstack/react-query";
import { searchPhotosByS3Key } from "@/app/actions";
import config from "@/config/site-config.json";

interface Photo {
  id: string;
  photographer: string;
  metadata: Record<string, unknown>;
  capturedAt: string;
  similarity: number;
  matchCount: number;
  url: string;
}

interface SearchResponse {
  results: Photo[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    totalFetched: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

interface UsePhotoSearchParams {
  s3Key: string | null;
  selectedFilter: string;
  enabled?: boolean;
}

// Helper function to convert display date to ISO format
const convertDateToISO = (displayDate: string): string | undefined => {
  if (displayDate === config.resultsView.allFilterLabel) return undefined;

  const dateMap: Record<string, string> = config.resultsView.dateMapping;

  return dateMap[displayDate];
};

export function usePhotoSearch({
  s3Key,
  selectedFilter,
  enabled = true,
}: UsePhotoSearchParams) {
  const isoDate = convertDateToISO(selectedFilter);

  return useInfiniteQuery<SearchResponse>({
    queryKey: ["photos", s3Key, selectedFilter],
    queryFn: async ({ pageParam = 1 }) => {
      if (!s3Key) throw new Error("No S3 key provided");
      const result = await searchPhotosByS3Key(
        s3Key,
        pageParam as number,
        20,
        isoDate
      );

      if ("error" in result) {
        throw new Error(result.error);
      }

      return result as SearchResponse;
    },
    getNextPageParam: (lastPage) => {
      return lastPage.pagination.hasNextPage
        ? lastPage.pagination.page + 1
        : undefined;
    },
    initialPageParam: 1,
    enabled: enabled && !!s3Key,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  });
}
