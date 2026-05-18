import type { Http } from "../http/fetcher";

export type University = {
  id: string;
  name: string;
  aliases: string[];
  country: string | null;
  is_verified: boolean;
  similarity: number;
};

export type SuggestedUniversity = {
  id: string;
  name: string;
  aliases: string[];
  country: string | null;
  is_verified: boolean;
  created_at: string;
};

export type SearchOptions = {
  country?: string;
  limit?: number;
  signal?: AbortSignal;
};

export type SuggestInput = {
  name: string;
  aliases?: string[];
  country?: string | null;
};

export const universitiesApi = {
  search(
    http: Http,
    query: string,
    opts: SearchOptions = {}
  ): Promise<University[]> {
    return http.get<University[]>("/universities", {
      params: { query, country: opts.country, limit: opts.limit ?? 8 },
      signal: opts.signal,
    });
  },

  suggest(http: Http, input: SuggestInput): Promise<SuggestedUniversity> {
    return http.post<SuggestedUniversity>("/universities/suggest", input);
  },
};

// Centralized query keys for this resource. Keeping them here (not inline in
// hooks) means invalidations from anywhere — e.g. after a successful suggest()
// — can target the exact key without typos.
export const universitiesKeys = {
  all: ["universities"] as const,
  search: (query: string, country?: string) =>
    [...universitiesKeys.all, "search", query, country ?? null] as const,
};
