"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useRef } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // Use useRef to prevent creating multiple clients on re-renders
  const queryClientRef = useRef<QueryClient | null>(null);

  if (!queryClientRef.current) {
    queryClientRef.current = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 5 * 60 * 1000, // 5 minutes
          gcTime: 10 * 60 * 1000, // 10 minutes
          refetchOnWindowFocus: false,
          refetchOnReconnect: false,
          retry: 1,
        },
      },
    });
  }

  return (
    <QueryClientProvider client={queryClientRef.current}>
      {children}
    </QueryClientProvider>
  );
}
