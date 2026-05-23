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
import { isoToDisplay } from "@/utils/availability-iso";
import { detectLength } from "@/utils/availability";

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
    city: p.city,
    countryCode: p.country_code,
    // OpenToId is the same string set as EngagementValue — see types/student.ts.
    // Backend has been observed to return null entries in this array on some
    // legacy rows; strip them so downstream code can trust the shape.
    openTo: (p.engagement_types ?? []).filter(
      (e): e is OpenToId => typeof e === "string"
    ),
    // Backend stores availability as ISO date strings ("2026-06-01"). The
    // detail view and edit form both consume the "Jun 2026" / "Now" /
    // "Ongoing" tokens — convert on the way out so neither downstream
    // consumer has to understand the wire format.
    availability: buildAvailability(p.available_from, p.available_to),
    internshipLength: deriveInternshipLength(
      p.engagement_types,
      p.available_from,
      p.available_to
    ),
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

// `from` defaults to "Now" when only `to` is present, and vice-versa, so the
// dropdowns always have a populated value even if the backend stored a
// one-sided window.
function buildAvailability(
  fromIso: string | null,
  toIso: string | null
): { from: string; to: string } | null {
  if (!fromIso && !toIso) return null;
  return {
    from: isoToDisplay(fromIso) ?? "Now",
    to: isoToDisplay(toIso) ?? "Ongoing",
  };
}

// internship_length isn't a column — the UI derives it from the date window
// using the same heuristic the join form uses. Only meaningful when the user
// actually opted into internships; otherwise the chip would be misleading.
function deriveInternshipLength(
  engagement: EngagementValue[] | null | undefined,
  fromIso: string | null,
  toIso: string | null
): string | null {
  const wantsInternships = (engagement ?? []).includes(
    "internships" as EngagementValue
  );
  if (!wantsInternships || !fromIso) return null;
  const fromDisplay = isoToDisplay(fromIso) ?? "Now";
  const toDisplay = isoToDisplay(toIso) ?? "Ongoing";
  return detectLength(fromDisplay, toDisplay) || null;
}
