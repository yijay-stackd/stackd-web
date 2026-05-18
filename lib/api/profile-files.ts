import type { Http } from "../http/fetcher";
import { env } from "../env";
import type { ProfileResponse } from "./profiles";

export type SignedUrlResponse = {
  url: string;
  expires_at: string;
};

// Backend constants — mirror storage/storage.constants.ts.
const PHOTO_BUCKET = "profile-photos";
const CV_BUCKET = "profile-cvs";

const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const CV_MAX_BYTES = 8 * 1024 * 1024;

export const FILES = {
  photo: {
    bucket: PHOTO_BUCKET,
    maxBytes: PHOTO_MAX_BYTES,
    accept: "image/jpeg,image/png,image/webp",
  },
  cv: {
    bucket: CV_BUCKET,
    maxBytes: CV_MAX_BYTES,
    accept: "application/pdf",
  },
} as const;

// Builds the Supabase Storage public URL from a `photo_key`. Returns null
// when Supabase isn't configured — caller (mapper) falls back to the
// avatar-color placeholder so the page still renders.
export function publicPhotoUrl(key: string | null): string | null {
  if (!key || !env.hasSupabase) return null;
  return `${env.supabaseUrl}/storage/v1/object/public/${PHOTO_BUCKET}/${encodeURI(key)}`;
}

function buildForm(file: File): FormData {
  const fd = new FormData();
  fd.append("file", file);
  return fd;
}

export const profileFilesApi = {
  uploadPhoto(http: Http, profileId: string, file: File): Promise<ProfileResponse> {
    return http.post<ProfileResponse>(
      `/profiles/${profileId}/photo`,
      undefined,
      { multipart: buildForm(file), skipRetry: true }
    );
  },

  deletePhoto(http: Http, profileId: string): Promise<ProfileResponse> {
    return http.delete<ProfileResponse>(`/profiles/${profileId}/photo`, {
      skipRetry: true,
    });
  },

  uploadCv(http: Http, profileId: string, file: File): Promise<ProfileResponse> {
    return http.post<ProfileResponse>(
      `/profiles/${profileId}/cv`,
      undefined,
      { multipart: buildForm(file), skipRetry: true }
    );
  },

  deleteCv(http: Http, profileId: string): Promise<ProfileResponse> {
    return http.delete<ProfileResponse>(`/profiles/${profileId}/cv`, {
      skipRetry: true,
    });
  },

  signedCvUrl(http: Http, profileId: string): Promise<SignedUrlResponse> {
    return http.get<SignedUrlResponse>(`/profiles/${profileId}/cv/signed`);
  },
};
