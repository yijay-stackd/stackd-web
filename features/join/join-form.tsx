"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateProfile } from "@/features/profile/use-profile-mutations";
import {
  engagementFromOpenTo,
  yearFromString,
} from "@/lib/api/profile-mapper";
import { dedupeSkillLabels, MAX_SKILLS, skillsApi } from "@/lib/api/skills";
import { profileFilesApi } from "@/lib/api/profile-files";
import { profileContactsApi } from "@/lib/api/profile-contacts";
import { profilesApi, profilesKeys } from "@/lib/api/profiles";
import { getHttpClient } from "@/lib/http/client";
import { ApiError } from "@/lib/http/errors";
import { Celebration } from "./celebration";
import {
  StudentForm,
  type StudentFormValues,
} from "@/components/forms/student-form";

const REDIRECT_DELAY_MS = 1700;

// Best-effort side-effects after a profile is created. Each call is allowed
// to fail without killing the rest — partial success is OK and the user can
// fix the missing pieces from the edit page.
//
// Calls the API clients directly with `profileId` from the freshly-created
// profile, NOT through useMutation hooks. The hooks would close over the
// component's `createdProfileId` state, which hasn't propagated past React's
// async setState boundary yet — so every write would crash on the
// `profileId required` guard before it left the browser.
type FollowupResult = { ok: boolean; label: string; message?: string };

async function runFollowups(
  profileId: string,
  values: StudentFormValues
): Promise<FollowupResult[]> {
  const http = getHttpClient();
  const tasks: Array<Promise<FollowupResult>> = [];

  if (values.photoFile) {
    tasks.push(
      profileFilesApi
        .uploadPhoto(http, profileId, values.photoFile)
        .then(() => ({ ok: true, label: "photo" }))
        .catch((e: unknown) => ({
          ok: false,
          label: "photo",
          message: e instanceof Error ? e.message : "upload failed",
        }))
    );
  }

  if (values.cvFile) {
    tasks.push(
      profileFilesApi
        .uploadCv(http, profileId, values.cvFile)
        .then(() => ({ ok: true, label: "cv" }))
        .catch((e: unknown) => ({
          ok: false,
          label: "cv",
          message: e instanceof Error ? e.message : "upload failed",
        }))
    );
  }

  // Skills must be sequential — backend assigns sort_order, server-side
  // throws on duplicate slots. Parallel writes would race for slot 0.
  // Dedupe FIRST so "React" + "react" don't double-POST the same slug and
  // trip the 409 SKILL_ALREADY_ASSIGNED that would abort the loop.
  const uniqueSkills = dedupeSkillLabels(values.tags).slice(0, MAX_SKILLS);

  if (uniqueSkills.length) {
    tasks.push(
      (async () => {
        for (let i = 0; i < uniqueSkills.length; i++) {
          try {
            await skillsApi.assign(http, profileId, {
              ...uniqueSkills[i],
              sort_order: i,
            });
          } catch (e) {
            return {
              ok: false,
              label: `skill "${uniqueSkills[i].slug}"`,
              message: e instanceof Error ? e.message : "assign failed",
            };
          }
        }
        return { ok: true, label: "skills" };
      })()
    );
  }

  if (values.contact.trim()) {
    tasks.push(
      profileContactsApi
        .create(http, profileId, {
          kind: values.contactType,
          value: values.contact.trim(),
        })
        .then(() => ({ ok: true, label: "contact" }))
        .catch((e: unknown) => ({
          ok: false,
          label: "contact",
          message: e instanceof Error ? e.message : "save failed",
        }))
    );
  }

  return Promise.all(tasks);
}

export function JoinForm() {
  const router = useRouter();
  const qc = useQueryClient();
  const createProfile = useCreateProfile();

  const [celebrating, setCelebrating] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [followupWarnings, setFollowupWarnings] = useState<string[]>([]);
  // Slug of the just-created profile — only set after a successful create,
  // used by the "Continue anyway" button when followups partially failed.
  const [profileSlug, setProfileSlug] = useState<string | null>(null);

  async function handleSubmit(values: StudentFormValues) {
    setSubmitError(null);
    setFollowupWarnings([]);

    if (!values.universityId) {
      setSubmitError(
        "Pick a university from the dropdown so we can match it correctly."
      );
      return;
    }
    const year = yearFromString(values.year);
    if (!year) {
      setSubmitError("Pick a year of study.");
      return;
    }

    try {
      const profile = await createProfile.mutateAsync({
        name: values.name,
        university_id: values.universityId,
        course: values.course,
        year,
        bio: values.bio,
        city: values.location ?? undefined,
        engagement_types: engagementFromOpenTo(values.openTo),
      });

      // Profile exists. Run side-effect uploads/skills/contact before deciding
      // whether to celebrate-and-redirect or surface partial-failure to the user.
      setProfileSlug(profile.slug);

      const results = await runFollowups(profile.id, values);

      const failed = results.filter((r) => !r.ok);
      if (failed.length > 0) {
        // Partial failure — stay on the form, show what didn't attach, let
        // user decide whether to continue or retry. The profile itself is live.
        setFollowupWarnings(
          failed.map((r) => `${r.label}: ${r.message ?? "failed"}`)
        );
        return;
      }

      // useCreateProfile deliberately does NOT prime mine/bySlug — the POST
      // response is incomplete (skills/contacts/photo/cv land via follow-ups
      // above). This is the one place that holds the canonical row: refetch
      // the now-complete profile and seed both caches BEFORE navigating, so
      // the profile page paints fully on first render with no flicker.
      const fresh = await profilesApi.bySlug(getHttpClient(), profile.slug);
      qc.setQueryData(profilesKeys.bySlug(profile.slug), fresh);
      qc.setQueryData(profilesKeys.mine(), fresh);

      // Clean success → celebrate, then redirect.
      setFirstName(values.name.split(" ")[0]);
      setCelebrating(true);
      setTimeout(() => {
        router.push(`/profile/${profile.slug}`);
      }, REDIRECT_DELAY_MS);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const first = err.details?.[0];
        setSubmitError(
          first ? `${first.field}: ${first.errors[0]}` : err.message
        );
      } else {
        setSubmitError(
          err instanceof Error
            ? err.message
            : "Couldn't create your profile. Try again."
        );
      }
    }
  }

  return (
    <div className="animate-pageIn">
      <div className="mx-auto max-w-135 px-7 pt-13 pb-24 max-[640px]:px-5">
        <div className="mb-3.5 block font-mono text-[11px] uppercase tracking-widest text-muted">
          Step 1 of 1 · No account needed
        </div>
        <h1 className="mb-3 text-[clamp(28px,4vw,40px)] font-semibold leading-[1.05] tracking-[-0.028em]">
          Build your bio.
        </h1>
        <p className="mb-10 text-[15px] text-muted">
          One page. One form. Live the moment you hit submit — and companies reach out directly.
        </p>

        {submitError && (
          <div className="mb-6 rounded-md border border-danger bg-[#fef2f2] px-3.5 py-3 text-[13.5px] text-danger">
            {submitError}
          </div>
        )}

        {followupWarnings.length > 0 && (
          <div className="mb-6 rounded-md border border-[#ecdfa3] bg-[#fdfaeb] px-3.5 py-3 text-[13px] text-fg">
            <strong className="block font-mono text-[11px] uppercase tracking-widest text-muted">
              Profile saved — some bits didn&apos;t attach:
            </strong>
            <ul className="mt-1 list-disc pl-5">
              {followupWarnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
            <span className="mt-1 block text-xs text-muted">
              Your profile is live. Continue to view it, or fix these from the
              edit page later.
            </span>
            {profileSlug && (
              <button
                type="button"
                onClick={() => router.push(`/profile/${profileSlug}`)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-fg px-3.5 py-2 text-[12.5px] font-semibold text-white transition-[transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow-btn-hover"
              >
                Continue to my profile →
              </button>
            )}
          </div>
        )}

        <StudentForm
          submitLabel="Go live"
          submittingLabel="Going live…"
          submitting={createProfile.isPending || celebrating}
          showSubmitHint
          onSubmit={handleSubmit}
        />
      </div>

      {celebrating && <Celebration firstName={firstName} />}
    </div>
  );
}
