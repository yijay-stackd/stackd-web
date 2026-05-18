"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getHttpClient } from "@/lib/http/client";
import {
  profilesKeys,
  type ProfileResponse,
} from "@/lib/api/profiles";
import {
  skillsApi,
  skillsKeys,
  type AssignSkillInput,
} from "@/lib/api/skills";

const MIN_QUERY = 1;

// Autocomplete for the skill picker. Disabled on empty input.
export function useSkillSearch(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: skillsKeys.search(trimmed),
    enabled: trimmed.length >= MIN_QUERY,
    queryFn: ({ signal }) =>
      skillsApi.search(getHttpClient(), trimmed, { signal }),
    staleTime: 60_000,
  });
}

// Skill writes return the new skill list (slug+label+sort_order). Patch the
// profile cache so `skills` stays in sync without refetching the whole profile.
function patchProfileSkills(
  qc: ReturnType<typeof useQueryClient>,
  skills: ProfileResponse["skills"]
) {
  const mine = qc.getQueryData<ProfileResponse | null>(profilesKeys.mine());
  if (!mine) return;
  const next: ProfileResponse = { ...mine, skills };
  qc.setQueryData(profilesKeys.mine(), next);
  qc.setQueryData(profilesKeys.bySlug(mine.slug), next);
}

export function useAssignSkill(profileId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AssignSkillInput) => {
      if (!profileId) throw new Error("useAssignSkill: profileId required");
      return skillsApi.assign(getHttpClient(), profileId, input);
    },
    onSuccess: (skills) => patchProfileSkills(qc, skills),
  });
}

export function useRemoveSkill(profileId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) => {
      if (!profileId) throw new Error("useRemoveSkill: profileId required");
      return skillsApi.remove(getHttpClient(), profileId, slug);
    },
    onSuccess: (skills) => patchProfileSkills(qc, skills),
  });
}
