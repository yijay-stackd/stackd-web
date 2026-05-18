import type { Http } from "../http/fetcher";
import type { ContactResponse } from "./profile-contacts";

// Backend value sets (sync with profiles/dto/create-profile.dto.ts).
export type YearValue = "1st" | "2nd" | "3rd" | "4th" | "Masters" | "PhD";

export type EngagementValue =
  | "internships"
  | "full_time"
  | "part_time"
  | "freelance"
  | "research";

export type ProfileStatus = "active" | "hidden" | "suspended";

export type ProfileResponse = {
  id: string;
  slug: string;
  name: string;
  photo_key: string | null;
  avatar_color_seed: number;

  university: { id: string; name: string; country: string | null };
  course: string;
  year: YearValue;

  country_code: string | null;
  city: string | null;
  is_remote_ok: boolean;

  bio: string;
  engagement_types: EngagementValue[];

  available_from: string | null;
  available_to: string | null;

  cv_key: string | null;
  cv_name: string | null;

  skills: { slug: string; label: string; sort_order: number }[];

  // Omitted on /feed responses to keep list payloads bounded.
  contacts?: ContactResponse[];

  // Backend currently omits `status` on /feed (only active profiles appear).
  // Single-profile reads include it.
  status?: ProfileStatus;
  status_reason: string | null;
  status_changed_at: string;
  version: number;
  created_at: string;
  updated_at: string;
};

export type FeedResponse = {
  data: ProfileResponse[];
  meta: { next_cursor: string | null };
};

export type CreateProfileInput = {
  name: string;
  university_id: string;
  course: string;
  year: YearValue;
  bio: string;

  country_code?: string;
  city?: string;
  is_remote_ok?: boolean;

  engagement_types?: EngagementValue[];
  available_from?: string;
  available_to?: string;
};

// Optimistic-lock: `version` must echo the row's current value, mismatch → 409.
export type UpdateProfileInput = Partial<CreateProfileInput> & {
  version: number;
};

export type UpdateStatusInput = {
  version: number;
  status: "active" | "hidden";
};

export type FeedQuery = {
  university_id?: string;
  year?: YearValue;
  engagement_types?: EngagementValue[];
  skill_slugs?: string[];
  country_code?: string;
  q?: string;
  cursor?: string;
  limit?: number;
};

export const profilesApi = {
  create(http: Http, body: CreateProfileInput): Promise<ProfileResponse> {
    return http.post<ProfileResponse>("/profiles", body, { skipRetry: true });
  },

  bySlug(
    http: Http,
    slug: string,
    signal?: AbortSignal
  ): Promise<ProfileResponse> {
    return http.get<ProfileResponse>(`/profiles/${encodeURIComponent(slug)}`, {
      signal,
    });
  },

  // Returns null when the authenticated user has no profile yet (404).
  mine(http: Http, signal?: AbortSignal): Promise<ProfileResponse | null> {
    return http
      .get<ProfileResponse>("/me/profile", { signal })
      .catch((err) => {
        if ((err as { status?: number }).status === 404) return null;
        throw err;
      });
  },

  async feed(
    http: Http,
    query: FeedQuery = {},
    signal?: AbortSignal
  ): Promise<FeedResponse> {
    const result = await http.getPaginated<
      ProfileResponse[],
      { next_cursor: string | null }
    >("/feed", {
      params: {
        university_id: query.university_id,
        year: query.year,
        engagement_types: query.engagement_types?.join(","),
        skill_slugs: query.skill_slugs?.join(","),
        country_code: query.country_code,
        q: query.q,
        cursor: query.cursor,
        limit: query.limit,
      },
      signal,
    });
    return {
      data: result.data,
      meta: result.meta ?? { next_cursor: null },
    };
  },

  update(
    http: Http,
    id: string,
    body: UpdateProfileInput
  ): Promise<ProfileResponse> {
    return http.patch<ProfileResponse>(`/profiles/${id}`, body, {
      skipRetry: true,
    });
  },

  updateStatus(
    http: Http,
    id: string,
    body: UpdateStatusInput
  ): Promise<ProfileResponse> {
    return http.patch<ProfileResponse>(`/profiles/${id}/status`, body, {
      skipRetry: true,
    });
  },

  remove(http: Http, id: string): Promise<{ deleted: true; id: string }> {
    return http.delete<{ deleted: true; id: string }>(`/profiles/${id}`, {
      skipRetry: true,
    });
  },
};

export const profilesKeys = {
  all: ["profiles"] as const,
  mine: () => [...profilesKeys.all, "mine"] as const,
  bySlug: (slug: string) => [...profilesKeys.all, "by-slug", slug] as const,
  // Prefix used by partial-key invalidation — matches every feed query.
  feeds: () => [...profilesKeys.all, "feed"] as const,
  feed: (query: FeedQuery) => [...profilesKeys.all, "feed", query] as const,
};
