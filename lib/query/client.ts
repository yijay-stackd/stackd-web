import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "../http/errors";

// Single QueryClient factory. We construct one per browser (in QueryProvider)
// and would construct a new one per server request if we ever fetch from RSC.
//
// Defaults mirror typical SPA expectations:
// - 30s freshness window so revisiting a screen doesn't refetch immediately
// - Don't retry on 4xx (caller bug or auth issue, retry won't help)
// - Retry transient failures up to 2x (http layer also retries, but TanStack's
//   retry runs at the query level — useful when the http retry budget is
//   exhausted)
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (error instanceof ApiError) {
            // 4xx is a client problem — retrying won't fix it.
            if (error.status >= 400 && error.status < 500) return false;
          }
          return failureCount < 2;
        },
      },
      mutations: {
        // Mutations don't auto-retry by default — caller decides.
        retry: false,
      },
    },
  });
}
