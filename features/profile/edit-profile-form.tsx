"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  useDeleteProfile,
  useUpdateProfile,
} from "./use-profile-mutations";
import {
  useUploadCv,
  useUploadPhoto,
} from "./use-profile-files";
import { useAssignSkill, useRemoveSkill } from "./use-skills";
import { useCreateContact, useUpdateContact } from "./use-contacts";
import {
  engagementFromOpenTo,
  toStudent,
  yearFromString,
} from "@/lib/api/profile-mapper";
import { displayToIso } from "@/utils/availability-iso";
import { dedupeSkillLabels, MAX_SKILLS } from "@/lib/api/skills";
import { ApiError } from "@/lib/http/errors";
import type { ProfileResponse } from "@/lib/api/profiles";
import {
  StudentForm,
  type StudentFormValues,
} from "@/components/forms/student-form";
import { EditHeader } from "./edit-header";
import { DangerZone } from "./danger-zone";
import { DeleteModal } from "./delete-modal";
import { Toast } from "@/components/ui/toast";

type Props = {
  profile: ProfileResponse;
};

export function EditProfileForm({ profile }: Props) {
  const router = useRouter();
  const updateProfile = useUpdateProfile(profile.id);
  const deleteProfile = useDeleteProfile(profile.id);
  const uploadPhoto = useUploadPhoto(profile.id);
  const uploadCv = useUploadCv(profile.id);
  const assignSkill = useAssignSkill(profile.id);
  const removeSkill = useRemoveSkill(profile.id);
  const createContact = useCreateContact(profile.id);
  const updateContact = useUpdateContact(profile.id);

  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [followupWarnings, setFollowupWarnings] = useState<string[]>([]);

  // Render the legacy form with translated initial values.
  const student = toStudent(profile);

  async function handleSave(values: StudentFormValues) {
    setSubmitError(null);

    // If the user didn't change the university, re-use the current id.
    const universityId =
      values.universityId ??
      (values.university === profile.university.name
        ? profile.university.id
        : null);

    if (!universityId) {
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
      const availFromIso = values.availability
        ? displayToIso(values.availability.from)
        : null;
      const availToIso = values.availability
        ? displayToIso(values.availability.to)
        : null;

      await updateProfile.mutateAsync({
        version: profile.version,
        name: values.name,
        university_id: universityId,
        course: values.course,
        year,
        bio: values.bio,
        city: values.city ?? undefined,
        country_code: values.countryCode ?? undefined,
        engagement_types: engagementFromOpenTo(values.openTo),
        available_from: availFromIso ?? undefined,
        available_to: availToIso ?? undefined,
      });

      // Side effects — best-effort, one warning per failure.
      const warnings: string[] = [];

      if (values.photoFile) {
        try {
          await uploadPhoto.mutateAsync(values.photoFile);
        } catch (e) {
          warnings.push(
            `photo: ${e instanceof Error ? e.message : "upload failed"}`
          );
        }
      }
      if (values.cvFile) {
        try {
          await uploadCv.mutateAsync(values.cvFile);
        } catch (e) {
          warnings.push(
            `cv: ${e instanceof Error ? e.message : "upload failed"}`
          );
        }
      }

      // Skill diff: remove what's gone, add what's new. Sequential so
      // backend's unique(profile_id, sort_order) constraint isn't violated.
      // Each mutation returns the post-change list — we trust THAT for
      // sort_order math, never our pre-mutation snapshot.
      // Dedupe by slug first — "React" + "react" collapse to one, otherwise
      // the second POST would 409 on unique(profile_id, skill_slug).
      const desiredSlugs = dedupeSkillLabels(values.tags).slice(0, MAX_SKILLS);
      const desiredSet = new Set(desiredSlugs.map((s) => s.slug));
      let liveSkills: { slug: string; sort_order: number }[] =
        profile.skills.map((s) => ({ slug: s.slug, sort_order: s.sort_order }));
      const initialSlugs = new Set(profile.skills.map((s) => s.slug));
      const toRemove = profile.skills
        .map((s) => s.slug)
        .filter((s) => !desiredSet.has(s));
      const toAdd = desiredSlugs.filter((s) => !initialSlugs.has(s.slug));

      for (const slug of toRemove) {
        try {
          liveSkills = await removeSkill.mutateAsync(slug);
        } catch (e) {
          warnings.push(
            `skill "${slug}": ${e instanceof Error ? e.message : "remove failed"}`
          );
        }
      }

      for (const s of toAdd) {
        // Pick the lowest unused sort_order in [0..MAX_SKILLS).
        const used = new Set(liveSkills.map((x) => x.sort_order));
        let nextSort = 0;
        while (nextSort < MAX_SKILLS && used.has(nextSort)) nextSort++;
        if (nextSort >= MAX_SKILLS) {
          warnings.push(`skill "${s.slug}": profile is full`);
          break;
        }
        try {
          liveSkills = await assignSkill.mutateAsync({
            slug: s.slug,
            label: s.label,
            sort_order: nextSort,
          });
        } catch (e) {
          warnings.push(
            `skill "${s.slug}": ${e instanceof Error ? e.message : "add failed"}`
          );
        }
      }

      // Contact: form has one slot. If an existing contact matches the legacy
      // type we display (linkedin/email/portfolio), PATCH it. Otherwise POST a
      // new one. Other contact kinds owned by the profile are left untouched.
      const formContactKind = values.contactType;
      const formContactValue = values.contact.trim();
      const existingPrimary = (profile.contacts ?? []).find(
        (c) =>
          c.kind === "linkedin" ||
          c.kind === "email" ||
          c.kind === "portfolio"
      );

      if (formContactValue) {
        try {
          if (existingPrimary) {
            const changed =
              existingPrimary.kind !== formContactKind ||
              existingPrimary.value !== formContactValue;
            if (changed) {
              await updateContact.mutateAsync({
                contactId: existingPrimary.id,
                body: { kind: formContactKind, value: formContactValue },
              });
            }
          } else {
            await createContact.mutateAsync({
              kind: formContactKind,
              value: formContactValue,
            });
          }
        } catch (e) {
          // 409 (duplicate exact value) is benign on resubmit — skip.
          if (!(e instanceof ApiError && e.status === 409)) {
            warnings.push(
              `contact: ${e instanceof Error ? e.message : "save failed"}`
            );
          }
        }
      }

      setFollowupWarnings(warnings);
      setSavedAt(Date.now());
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setSubmitError(
          "Someone updated this profile in another tab — refresh to get the latest."
        );
      } else if (err instanceof ApiError && err.status === 422) {
        const first = err.details?.[0];
        setSubmitError(
          first ? `${first.field}: ${first.errors[0]}` : err.message
        );
      } else {
        setSubmitError(
          err instanceof Error ? err.message : "Couldn't save changes."
        );
      }
    }
  }

  function handleCancel() {
    router.push(`/profile/${profile.slug}`);
  }

  async function handleDeleteConfirm() {
    try {
      await deleteProfile.mutateAsync();
      setDeleteOpen(false);
      router.push("/");
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Couldn't delete profile."
      );
      setDeleteOpen(false);
    }
  }

  return (
    <div className="animate-pageIn">
      <div className="mx-auto max-w-135 px-7 pt-10 pb-24 max-[640px]:px-5">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href={`/profile/${profile.slug}`}
            className="inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors duration-150 hover:text-fg"
          >
            <svg
              className="text-muted-2"
              width="12"
              height="12"
              viewBox="0 0 14 14"
              fill="none"
            >
              <path
                d="M9 3L5 7L9 11"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Back to profile
          </Link>
          <Link
            href={`/profile/${profile.slug}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-line-2 bg-white px-2.5 py-1.25 text-[12.5px] font-medium text-muted transition-[color,border-color] duration-150 hover:border-fg hover:text-fg"
          >
            View live{" "}
            <svg
              className="text-muted-2"
              width="11"
              height="11"
              viewBox="0 0 14 14"
              fill="none"
            >
              <path
                d="M5 9L9 5M9 5H6M9 5V8"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </div>

        <EditHeader student={student} />

        {submitError && (
          <div className="mb-6 rounded-md border border-danger bg-[#fef2f2] px-3.5 py-3 text-[13.5px] text-danger">
            {submitError}
          </div>
        )}

        {followupWarnings.length > 0 && (
          <div className="mb-6 rounded-md border border-[#ecdfa3] bg-[#fdfaeb] px-3.5 py-3 text-[13px] text-fg">
            <strong className="block font-mono text-[11px] uppercase tracking-widest text-muted">
              Saved with warnings:
            </strong>
            <ul className="mt-1 list-disc pl-5">
              {followupWarnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        <StudentForm
          initial={student}
          submitLabel="Save changes"
          submittingLabel="Saving…"
          submitting={updateProfile.isPending}
          onSubmit={handleSave}
          onCancel={handleCancel}
          cancelLabel="Cancel"
        />

        <DangerZone onDelete={() => setDeleteOpen(true)} />
      </div>

      <DeleteModal
        open={deleteOpen}
        studentName={student.name}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={handleDeleteConfirm}
      />

      <Toast
        open={savedAt !== null}
        message="Changes saved"
        onDone={() => setSavedAt(null)}
      />
    </div>
  );
}
