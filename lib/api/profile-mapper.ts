// Adapter: backend ProfileResponse → legacy Student shape used by the existing
// row/detail UI. As components migrate to ProfileResponse directly, this file
// shrinks. Delete when no consumers remain.

import { PHOTO_COLORS } from "@/constants/student-options";
import type { ContactType, OpenToId, Student } from "@/types/student";
import type {
  EngagementValue,
  ProfileResponse,
  YearValue,
} from "./profiles";
import { publicPhotoUrl } from "./profile-files";
import type { ContactResponse } from "./profile-contacts";

// Backend ContactKindValue is wider than frontend ContactType. Project the
// extra kinds onto the closest legacy bucket so the single-contact UI still
// renders. Multi-contact UI is a separate feature.
function projectContactType(kind: ContactResponse["kind"]): ContactType {
  if (kind === "email") return "email";
  if (kind === "linkedin") return "linkedin";
  return "portfolio";
}

function pickPrimaryContact(
  contacts: ContactResponse[] | undefined
): { contactType: ContactType; contact: string } {
  if (!contacts || contacts.length === 0) {
    return { contactType: "linkedin", contact: "" };
  }
  // Sort by sort_order asc, take the first.
  const sorted = [...contacts].sort((a, b) => a.sort_order - b.sort_order);
  const top = sorted[0];
  return {
    contactType: projectContactType(top.kind),
    contact: top.value,
  };
}

function pickColor(seed: number): string {
  return PHOTO_COLORS[seed % PHOTO_COLORS.length];
}

function locationString(p: ProfileResponse): string | null {
  if (p.city && p.country_code) return `${p.city}, ${p.country_code}`;
  return p.city || p.country_code || null;
}

export function toStudent(p: ProfileResponse): Student {
  const primaryContact = pickPrimaryContact(p.contacts);
  return {
    slug: p.slug,
    name: p.name,
    university: p.university.name,
    course: p.course,
    year: p.year,
    location: locationString(p),
    // OpenToId is the same string set as EngagementValue — see types/student.ts.
    // Backend has been observed to return null entries in this array on some
    // legacy rows; strip them so downstream code can trust the shape.
    openTo: (p.engagement_types ?? []).filter(
      (e): e is OpenToId => typeof e === "string"
    ),
    availability:
      p.available_from || p.available_to
        ? {
            from: p.available_from ?? "Now",
            to: p.available_to ?? "Ongoing",
          }
        : null,
    internshipLength: null,
    bio: p.bio,
    // Display labels, not slugs. /feed includes both per backend Option-A change.
    tags: p.skills.map((s) => s.label),
    contactType: primaryContact.contactType,
    contact: primaryContact.contact,
    email: null,
    photo: publicPhotoUrl(p.photo_key),
    photoColor: pickColor(p.avatar_color_seed),
    cvDataUrl: null,
    cvName: p.cv_name,
    addedAt: p.created_at.slice(0, 10),
    updatedAt: p.updated_at,
  };
}

export function engagementFromOpenTo(ids: OpenToId[]): EngagementValue[] {
  return ids as unknown as EngagementValue[];
}

const YEAR_VALUES: readonly YearValue[] = [
  "1st",
  "2nd",
  "3rd",
  "4th",
  "Masters",
  "PhD",
];

export function yearFromString(value: string): YearValue | null {
  return (YEAR_VALUES as readonly string[]).includes(value)
    ? (value as YearValue)
    : null;
}
