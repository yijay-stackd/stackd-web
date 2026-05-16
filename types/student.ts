export type ContactType = "linkedin" | "email" | "portfolio";

export type OpenToId =
  | "internships"
  | "full-time"
  | "part-time"
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
  slug: string | null;
};
