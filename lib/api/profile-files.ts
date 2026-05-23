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

// Matches stackd-backend PHOTO_MAX_BYTES. Real uploads go through
// `compressPhotoForUpload` first and land far below this, so the limit is
// only ever a backstop for un-compressed bypasses.
const PHOTO_MAX_BYTES = 2 * 1024 * 1024;
const CV_MAX_BYTES = 8 * 1024 * 1024;

// Pre-compression input cap — generous, since the compressor will shrink
// anything reasonable to <1 MB. Anything bigger than this is almost
// certainly a phone burst / RAW file the user picked by accident.
const PHOTO_PRE_COMPRESS_MAX_BYTES = 30 * 1024 * 1024;

export const FILES = {
  photo: {
    bucket: PHOTO_BUCKET,
    maxBytes: PHOTO_MAX_BYTES,
    preCompressMaxBytes: PHOTO_PRE_COMPRESS_MAX_BYTES,
    // HEIC intentionally omitted — iOS Safari converts HEIC→JPEG when not
    // listed here. Standard pattern used by Instagram / Shopify / Vinted.
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
  // Uploads retry only on transient errors (NetworkError, 408/429/5xx).
  // The fetcher's isRetryable() never retries 4xx, so MIME / size validation
  // failures still fail loud. Multipart body (FormData) is safely re-readable.
  uploadPhoto(http: Http, profileId: string, file: File): Promise<ProfileResponse> {
    return http.post<ProfileResponse>(
      `/profiles/${profileId}/photo`,
      undefined,
      { multipart: buildForm(file) }
    );
  },

  // Delete is destructive — keep skipRetry so a stalled response doesn't
  // accidentally fire a second delete after the user has already navigated.
  deletePhoto(http: Http, profileId: string): Promise<ProfileResponse> {
    return http.delete<ProfileResponse>(`/profiles/${profileId}/photo`, {
      skipRetry: true,
    });
  },

  uploadCv(http: Http, profileId: string, file: File): Promise<ProfileResponse> {
    return http.post<ProfileResponse>(
      `/profiles/${profileId}/cv`,
      undefined,
      { multipart: buildForm(file) }
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
