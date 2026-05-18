import type { Http } from "../http/fetcher";

export type SkillSearchRow = {
  slug: string;
  label: string;
  usage_count: number;
  similarity: number;
};

export type ProfileSkillEntry = {
  slug: string;
  label: string;
  sort_order: number;
};

export type AssignSkillInput = {
  slug: string;
  label?: string;
  sort_order: number;
};

export type ReorderInput = {
  items: { slug: string; sort_order: number }[];
};

export const MAX_SKILLS = 6;
export const SKILL_SLUG_RX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Coerce a user-entered tag (e.g. "React Native") into a backend-valid slug.
export function toSkillSlug(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Dedupe user-typed tags by their derived slug, preserving first-occurrence
// order. Drops empty slugs ("---" → ""). Caller is responsible for slicing to
// MAX_SKILLS. Without this, "React" and "react" both normalize to "react" and
// the second POST trips the backend's unique(profile_id, skill_slug) constraint
// (409 SKILL_ALREADY_ASSIGNED), aborting any further skill writes in the loop.
export function dedupeSkillLabels(
  labels: string[]
): { slug: string; label: string }[] {
  const seen = new Set<string>();
  const out: { slug: string; label: string }[] = [];
  for (const label of labels) {
    const slug = toSkillSlug(label);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push({ slug, label });
  }
  return out;
}

export const skillsApi = {
  search(
    http: Http,
    query: string,
    opts?: { limit?: number; signal?: AbortSignal }
  ): Promise<SkillSearchRow[]> {
    return http.get<SkillSearchRow[]>("/skills", {
      params: { query, limit: opts?.limit ?? 10 },
      signal: opts?.signal,
    });
  },

  assign(
    http: Http,
    profileId: string,
    body: AssignSkillInput
  ): Promise<ProfileSkillEntry[]> {
    return http.post<ProfileSkillEntry[]>(
      `/profiles/${profileId}/skills`,
      body,
      { skipRetry: true }
    );
  },

  reorder(
    http: Http,
    profileId: string,
    body: ReorderInput
  ): Promise<ProfileSkillEntry[]> {
    return http.patch<ProfileSkillEntry[]>(
      `/profiles/${profileId}/skills/reorder`,
      body,
      { skipRetry: true }
    );
  },

  remove(
    http: Http,
    profileId: string,
    slug: string
  ): Promise<ProfileSkillEntry[]> {
    return http.delete<ProfileSkillEntry[]>(
      `/profiles/${profileId}/skills/${encodeURIComponent(slug)}`,
      { skipRetry: true }
    );
  },
};

export const skillsKeys = {
  all: ["skills"] as const,
  search: (query: string) => [...skillsKeys.all, "search", query] as const,
};
