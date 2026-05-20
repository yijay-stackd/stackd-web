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

// Cache hygiene rule used by mutations whose response is the COMPLETE row
// (i.e. update/status). For these we can prime mine/bySlug directly:
// - setQueryData for the rows we just authoritatively know
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

// CREATE is a special case: the POST /profiles response is INCOMPLETE because
// skills/contacts/photo/cv are attached via separate follow-up calls fired
// after this mutation resolves. Priming mine/bySlug here would poison those
// caches with empty relations until the next refetch — the exact bug that
// shows the user a "live" profile with no skills, no contact, no photo.
//
// Instead: only invalidate the feed prefix (so the directory reflects the new
// row) and leave mine/bySlug alone. The caller (join-form) seeds them after
// the follow-ups complete, with the canonical row pulled from GET /profiles.
export function useCreateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateProfileInput) =>
      profilesApi.create(getHttpClient(), body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: profilesKeys.feeds() });
    },
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
