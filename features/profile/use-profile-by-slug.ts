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
    // Always refetch when the profile page mounts. Cached data primed by
    // create/edit mutations is sometimes incomplete (side-effect writes
    // happen AFTER the initial profile response), so we'd otherwise paint
    // an empty shell — no photo, no skills, no contact — until the user
    // refreshed. Force-fresh fixes that for free.
    refetchOnMount: "always",
  });
}
