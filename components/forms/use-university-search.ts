"use client";

import { useQuery } from "@tanstack/react-query";
import { getHttpClient } from "@/lib/http/client";
import {
  universitiesApi,
  universitiesKeys,
  type University,
} from "@/lib/api/universities";

type Options = {
  country?: string;
  limit?: number;
};

const MIN_QUERY = 1;

// Autocomplete-friendly query: disabled until there's something to search for,
// and AbortSignal-aware so TanStack cancels in-flight fetches when the query
// key changes (user keeps typing).
export function useUniversitySearch(query: string, opts: Options = {}) {
  const trimmed = query.trim();

  return useQuery<University[]>({
    queryKey: universitiesKeys.search(trimmed, opts.country),
    enabled: trimmed.length >= MIN_QUERY,
    queryFn: ({ signal }) =>
      universitiesApi.search(getHttpClient(), trimmed, {
        country: opts.country,
        limit: opts.limit,
        signal,
      }),
    // Universities barely change — keep results fresh for a minute so backing
    // up and retyping the same query is instant.
    staleTime: 60_000,
  });
}
