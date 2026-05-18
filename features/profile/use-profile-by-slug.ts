"use client";

import { useQuery } from "@tanstack/react-query";
import { getHttpClient } from "@/lib/http/client";
import { profilesApi, profilesKeys } from "@/lib/api/profiles";

// Public profile by slug. Re-runs whenever the slug changes; suspends/refetches
// nothing extra when navigating between profiles.
export function useProfileBySlug(slug: string | null | undefined) {
  return useQuery({
    queryKey: slug ? profilesKeys.bySlug(slug) : profilesKeys.bySlug("__none__"),
    enabled: Boolean(slug),
    queryFn: ({ signal }) =>
      profilesApi.bySlug(getHttpClient(), slug as string, signal),
  });
}
