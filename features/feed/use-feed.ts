"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { getHttpClient } from "@/lib/http/client";
import {
  profilesApi,
  profilesKeys,
  type FeedQuery,
  type FeedResponse,
} from "@/lib/api/profiles";

// Infinite scroll over the /feed endpoint. Uses TanStack's useInfiniteQuery,
// which handles cursor pagination, dedup, and merging pages for us.
//
// Pages flatten via `data.pages.flatMap(p => p.data)` at the call site.
export function useFeed(query: FeedQuery = {}) {
  return useInfiniteQuery({
    queryKey: profilesKeys.feed(query),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      profilesApi.feed(
        getHttpClient(),
        { ...query, cursor: pageParam },
        signal
      ),
    getNextPageParam: (lastPage: FeedResponse) =>
      lastPage.meta.next_cursor ?? undefined,
  });
}
