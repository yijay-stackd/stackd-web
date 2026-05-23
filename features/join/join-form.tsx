"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateProfile } from "@/features/profile/use-profile-mutations";
import {
  engagementFromOpenTo,
  yearFromString,
} from "@/lib/api/profile-mapper";
import { dedupeSkillLabels, MAX_SKILLS, skillsApi } from "@/lib/api/skills";
import { profileFilesApi, publicPhotoUrl } from "@/lib/api/profile-files";
import { profileContactsApi } from "@/lib/api/profile-contacts";
import { profilesApi, profilesKeys } from "@/lib/api/profiles";
import { getHttpClient } from "@/lib/http/client";
import { ApiError } from "@/lib/http/errors";
import { Celebration } from "./celebration";
import { SubmittingOverlay } from "./submitting-overlay";
import {
  StudentForm,
  type StudentFormValues,
} from "@/components/forms/student-form";

const REDIRECT_DELAY_MS = 1700;
// Supabase public URLs are eventually consistent — a HEAD against the newly
// uploaded key can 404 for a few seconds even after the upload returns 200.
// Poll the URL until it resolves (or give up) before navigating, so the
// profile page renders with the photo on first paint instead of a broken img.
const PHOTO_READY_TIMEOUT_MS = 6000;
const PHOTO_READY_POLL_MS = 400;

async function waitForPhotoReady(url: string): Promise<void> {
  const deadline = Date.now() + PHOTO_READY_TIMEOUT_MS;
  // Use Image() rather than fetch() to dodge CORS preflight on the Supabase
  // public bucket. A successful load also primes the browser cache so the
  // profile page's <img> renders instantly.
  while (Date.now() < deadline) {
    const ok = await new Promise<boolean>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      // Cache-bust each attempt so a cached 404 doesn't pin the result.
      img.src = `${url}?t=${Date.now()}`;
    });
    if (ok) {
      // Final non-busted load → seeds the cache under the canonical URL the
      // profile page will request.
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = url;
      });
      return;
    }
    await new Promise((r) => setTimeout(r, PHOTO_READY_POLL_MS));
  }
}

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
        .then(async (resp) => {
          // Wait until the public URL actually serves the file. Without this
          // poll the redirect can fire while Supabase is still propagating,
          // and the profile page renders a broken <img>.
          const url = publicPhotoUrl(resp.photo_key);
          if (url) await waitForPhotoReady(url);
          return { ok: true, label: "photo" };
        })
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

  // Single `submitting` flag covering create + followups + bySlug refetch.
  // `createProfile.isPending` alone has a gap between mutateAsync resolving
  // and the followups completing, during which the button re-enables and
  // the user thinks nothing happened.
  const [submitting, setSubmitting] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [followupWarnings, setFollowupWarnings] = useState<string[]>([]);
  // Slug of the just-created profile — only set after a successful create,
  // used by the "Continue anyway" button when followups partially failed.
  const [profileSlug, setProfileSlug] = useState<string | null>(null);

  const errorRef = useRef<HTMLDivElement | null>(null);
  const warningsRef = useRef<HTMLDivElement | null>(null);

  // The submit button sits at the bottom of a long form. When the inline
  // error/warning banner appears at the top, the user can't see it. Scroll
  // it into view whenever it shows up.
  useEffect(() => {
    if (submitError && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [submitError]);

  useEffect(() => {
    if (followupWarnings.length > 0 && warningsRef.current) {
      warningsRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [followupWarnings]);

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

    setSubmitting(true);
    try {
      const profile = await createProfile.mutateAsync({
        name: values.name,
        university_id: values.universityId,
        course: values.course,
        year,
        bio: values.bio,
        city: values.city ?? undefined,
        country_code: values.countryCode ?? undefined,
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
        setSubmitting(false);
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

      // Clean success → celebrate, then redirect. Keep `submitting` true so
      // the overlay stays up until Celebration takes over.
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
      setSubmitting(false);
    }
  }

  // Loading and celebration are rendered as REPLACEMENTS for the form, not
  // overlays. The form sits inside `animate-pageIn` which applies a transform;
  // any `position: fixed` descendant of a transformed ancestor positions
  // relative to that ancestor instead of the viewport — which is why the
  // overlay was offset on mobile. Swapping the entire view avoids the trap
  // and keeps the loading screen viewport-centered on every device.
  if (celebrating) return <Celebration firstName={firstName} />;
  if (submitting) return <SubmittingOverlay />;

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
          <div
            ref={errorRef}
            role="alert"
            className="mb-6 rounded-md border border-danger bg-[#fef2f2] px-3.5 py-3 text-[13.5px] text-danger"
          >
            {submitError}
          </div>
        )}

        {followupWarnings.length > 0 && (
          <div
            ref={warningsRef}
            role="alert"
            className="mb-6 rounded-md border border-[#ecdfa3] bg-[#fdfaeb] px-3.5 py-3 text-[13px] text-fg"
          >
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
          submitting={submitting}
          showSubmitHint
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
}
