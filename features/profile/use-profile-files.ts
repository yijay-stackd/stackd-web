"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getHttpClient } from "@/lib/http/client";
import {
  profilesKeys,
  type ProfileResponse,
} from "@/lib/api/profiles";
import { profileFilesApi } from "@/lib/api/profile-files";

function primeCache(
  qc: ReturnType<typeof useQueryClient>,
  profile: ProfileResponse
) {
  qc.setQueryData(profilesKeys.mine(), profile);
  qc.setQueryData(profilesKeys.bySlug(profile.slug), profile);
  qc.invalidateQueries({ queryKey: profilesKeys.feeds() });
}

export function useUploadPhoto(profileId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      if (!profileId) throw new Error("useUploadPhoto: profileId required");
      return profileFilesApi.uploadPhoto(getHttpClient(), profileId, file);
    },
    onSuccess: (profile) => primeCache(qc, profile),
  });
}

export function useDeletePhoto(profileId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => {
      if (!profileId) throw new Error("useDeletePhoto: profileId required");
      return profileFilesApi.deletePhoto(getHttpClient(), profileId);
    },
    onSuccess: (profile) => primeCache(qc, profile),
  });
}

export function useUploadCv(profileId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      if (!profileId) throw new Error("useUploadCv: profileId required");
      return profileFilesApi.uploadCv(getHttpClient(), profileId, file);
    },
    onSuccess: (profile) => primeCache(qc, profile),
  });
}

export function useDeleteCv(profileId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => {
      if (!profileId) throw new Error("useDeleteCv: profileId required");
      return profileFilesApi.deleteCv(getHttpClient(), profileId);
    },
    onSuccess: (profile) => primeCache(qc, profile),
  });
}

// Fetched on-demand (button click) — short-lived URL, no caching benefit.
export function useFetchSignedCv() {
  return useMutation({
    mutationFn: (profileId: string) =>
      profileFilesApi.signedCvUrl(getHttpClient(), profileId),
  });
}
