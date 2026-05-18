"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getHttpClient } from "@/lib/http/client";
import {
  profilesApi,
  profilesKeys,
  type CreateProfileInput,
  type ProfileResponse,
  type UpdateProfileInput,
  type UpdateStatusInput,
} from "@/lib/api/profiles";

// Cache hygiene rule used by every mutation here:
// - setQueryData for the rows we just authoritatively know (mine + bySlug)
// - invalidate only the feed prefix — refetching mine/bySlug would discard
//   the data we literally just wrote.
function primeAndInvalidate(
  qc: ReturnType<typeof useQueryClient>,
  profile: ProfileResponse
) {
  qc.setQueryData(profilesKeys.mine(), profile);
  qc.setQueryData(profilesKeys.bySlug(profile.slug), profile);
  qc.invalidateQueries({ queryKey: profilesKeys.feeds() });
}

export function useCreateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateProfileInput) =>
      profilesApi.create(getHttpClient(), body),
    onSuccess: (profile) => primeAndInvalidate(qc, profile),
  });
}

export function useUpdateProfile(profileId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateProfileInput) => {
      if (!profileId) throw new Error("useUpdateProfile: profileId required");
      return profilesApi.update(getHttpClient(), profileId, body);
    },
    onSuccess: (profile) => primeAndInvalidate(qc, profile),
  });
}

export function useUpdateProfileStatus(profileId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateStatusInput) => {
      if (!profileId)
        throw new Error("useUpdateProfileStatus: profileId required");
      return profilesApi.updateStatus(getHttpClient(), profileId, body);
    },
    onSuccess: (profile) => primeAndInvalidate(qc, profile),
  });
}

export function useDeleteProfile(profileId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => {
      if (!profileId) throw new Error("useDeleteProfile: profileId required");
      return profilesApi.remove(getHttpClient(), profileId);
    },
    onSuccess: () => {
      qc.setQueryData(profilesKeys.mine(), null);
      qc.invalidateQueries({ queryKey: profilesKeys.feeds() });
    },
  });
}
