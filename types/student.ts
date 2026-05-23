export type ContactType = "linkedin" | "email" | "portfolio";

// Matches the backend's EngagementValue exactly so no runtime mapping is
// needed when reading from or writing to the API.
export type OpenToId =
  | "internships"
  | "full_time"
  | "part_time"
  | "freelance"
  | "research";

export type Availability = {
  from: string;
  to: string;
};

export type Student = {
  slug: string;
  name: string;
  university: string;
  course: string;
  year: string;
  location: string | null;
  // Structured location parts powering the LocationPicker. `location` above
  // remains the joined display string ("London, GB") used by read-only views.
  city: string | null;
  countryCode: string | null;
  openTo: OpenToId[];
  availability: Availability | null;
  internshipLength: string | null;
  cvName: string | null;
  cvDataUrl?: string | null;
  bio: string;
  tags: string[];
  contactType: ContactType;
  contact: string;
  email?: string | null;
  photo?: string | null;
  photoColor: string;
  addedAt: string;
  updatedAt?: string | null;
};

export type AuthUser = {
  email: string;
};
