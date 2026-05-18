"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/auth-provider";
import { getHttpClient } from "@/lib/http/client";
import { profilesApi, profilesKeys } from "@/lib/api/profiles";

// The authenticated user's own profile. Returns `null` when the user is
// signed in but hasn't created a profile yet (backend 404 → null).
export function useMyProfile() {
  const { status } = useAuth();
  const enabled = status === "authenticated";

  return useQuery({
    queryKey: profilesKeys.mine(),
    enabled,
    queryFn: ({ signal }) => profilesApi.mine(getHttpClient(), signal),
  });
}
