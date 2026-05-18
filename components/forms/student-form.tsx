"use client";

import { useState } from "react";
import {
  CONTACT_TYPES,
  OPEN_TO_OPTIONS,
  YEAR_OPTIONS,
} from "@/constants/student-options";
import type {
  Availability,
  ContactType,
  OpenToId,
  Student,
} from "@/types/student";
import { PhotoUpload } from "@/features/join/photo-upload";
import { TagInput } from "@/features/join/tag-input";
import { CvUpload } from "@/features/join/cv-upload";
import { AvailabilityField } from "@/features/join/availability-field";
import { UniversityAutocomplete } from "@/components/forms/university-autocomplete";

const BIO_LIMIT = 100;
const TAG_LIMIT = 6;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const baseInputClass =
  "w-full rounded-md border bg-white px-3.5 py-2.75 text-[14.5px] outline-none transition-[border-color,box-shadow] duration-150 focus:border-fg focus:shadow-focus-ring";

export type StudentFormValues = {
  name: string;
  photo: string | null;
  // Raw photo File from the file picker — null when user kept the existing
  // photo or never set one. Used by the create/update flow for multipart upload.
  photoFile: File | null;
  university: string;
  // Backend needs this to create/update a profile. Null when the user typed
  // a freeform name without selecting from autocomplete — caller validates.
  universityId: string | null;
  course: string;
  year: string;
  location: string | null;
  openTo: OpenToId[];
  availability: Availability | null;
  internshipLength: string | null;
  bio: string;
  tags: string[];
  contactType: ContactType;
  contact: string;
  cvDataUrl: string | null;
  cvName: string | null;
  cvFile: File | null;
};

type Props = {
  initial?: Partial<Student> | null;
  submitLabel: string;
  submittingLabel: string;
  submitting?: boolean;
  showSubmitHint?: boolean;
  onSubmit: (values: StudentFormValues) => void;
  onCancel?: () => void;
  cancelLabel?: string;
};

export function StudentForm({
  initial,
  submitLabel,
  submittingLabel,
  submitting = false,
  showSubmitHint = false,
  onSubmit,
  onCancel,
  cancelLabel = "Cancel",
}: Props) {
  const init = initial || {};
  const [name, setName] = useState(init.name || "");
  const [photo, setPhoto] = useState<string | null>(init.photo || null);
  // File handles for upload — initial values never have these (they came from
  // the backend, not a file picker).
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [university, setUniversity] = useState(init.university || "");
  // Backend's create-profile.dto requires universityId (UUID). Populated when
  // the user picks from the autocomplete; cleared when they edit the field.
  const [universityId, setUniversityId] = useState<string | null>(null);
  const [course, setCourse] = useState(init.course || "");
  const [year, setYear] = useState(init.year || "");
  const [location, setLocation] = useState(init.location || "");
  const [openTo, setOpenTo] = useState<OpenToId[]>(
    Array.isArray(init.openTo) ? init.openTo : []
  );
  const [availFrom, setAvailFrom] = useState(init.availability?.from || "Now");
  const [availTo, setAvailTo] = useState(init.availability?.to || "Ongoing");
  const [internshipLength, setInternshipLength] = useState(
    init.internshipLength || ""
  );
  const [bio, setBio] = useState(init.bio || "");
  const [tags, setTags] = useState<string[]>(
    Array.isArray(init.tags) ? init.tags : []
  );
  const [contactType, setContactType] = useState<ContactType>(
    init.contactType || "linkedin"
  );
  const [contact, setContact] = useState(init.contact || "");
  const [cvDataUrl, setCvDataUrl] = useState<string | null>(
    init.cvDataUrl || null
  );
  const [cvName, setCvName] = useState<string | null>(init.cvName || null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function toggleOpenTo(id: OpenToId) {
    setOpenTo((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Add your name";
    if (!university.trim()) e.university = "Which university?";
    if (!course.trim()) e.course = "What are you studying?";
    if (!year) e.year = "Pick a year";
    if (!bio.trim()) e.bio = "Add a one-liner so people know what you're about";
    if (bio.length > BIO_LIMIT) e.bio = `${bio.length}/${BIO_LIMIT} — shorten a touch`;
    if (tags.length === 0) e.tags = "Add at least one skill tag";
    if (!contact.trim()) e.contact = "How should companies reach you?";
    if (contactType === "email" && contact && !EMAIL_REGEX.test(contact)) {
      e.contact = "That doesn't look like an email";
    }
    return e;
  }

  function handleSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      const firstKey = Object.keys(e)[0];
      const el = document.querySelector(`[data-field="${firstKey}"]`);
      if (el) (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const wantsInternships = openTo.includes("internships");
    onSubmit({
      name: name.trim(),
      photo: photo || null,
      photoFile,
      university: university.trim(),
      universityId,
      course: course.trim(),
      year,
      location: location.trim() || null,
      openTo,
      availability: openTo.length
        ? { from: availFrom || "Now", to: availTo || "Ongoing" }
        : null,
      internshipLength: wantsInternships && internshipLength ? internshipLength : null,
      bio: bio.trim(),
      tags,
      contactType,
      contact: contact.trim(),
      cvDataUrl,
      cvName,
      cvFile,
    });
  }

  const charCount = bio.length;
  const overLimit = charCount > BIO_LIMIT;

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Field label="Profile photo" optional dataField="photo">
        <PhotoUpload
          value={photo}
          onChange={setPhoto}
          onFileChange={setPhotoFile}
          name={name}
        />
      </Field>

      <Field label="Full name" dataField="name" error={errors.name}>
        <input
          className={`${baseInputClass} ${
            errors.name ? "border-danger shadow-err-ring" : "border-line-2"
          }`}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Maya Chen"
          autoComplete="name"
        />
      </Field>

      <Field label="University" dataField="university" error={errors.university}>
        <UniversityAutocomplete
          value={university}
          onChange={(next) => {
            setUniversity(next);
            // Editing the field invalidates the previous selection — clear
            // the id so we don't submit a stale UUID.
            if (universityId) setUniversityId(null);
          }}
          onPick={(row) => setUniversityId(row?.id ?? null)}
          hasError={Boolean(errors.university)}
          className={`${baseInputClass} ${
            errors.university ? "border-danger shadow-err-ring" : "border-line-2"
          }`}
        />
      </Field>

      <Field label="Course / Major" dataField="course" error={errors.course}>
        <input
          className={`${baseInputClass} ${
            errors.course ? "border-danger shadow-err-ring" : "border-line-2"
          }`}
          type="text"
          value={course}
          onChange={(e) => setCourse(e.target.value)}
          placeholder="Computer Science"
        />
      </Field>

      <Field label="Year of study" dataField="year" error={errors.year}>
        <div className="inline-flex max-w-full flex-wrap gap-1 rounded-lg border border-line bg-[#f0eee5] p-0.75">
          {YEAR_OPTIONS.map((y) => (
            <button
              type="button"
              key={y}
              className={`rounded-md px-2.75 py-1.5 text-[13px] font-medium transition-all duration-150 ${
                year === y ? "bg-white text-fg shadow-sm" : "text-muted hover:text-fg"
              }`}
              onClick={() => setYear(y)}
            >
              {y}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Open to" dataField="openTo" optional optionalText="Optional · pick any">
        <div className="inline-flex max-w-full flex-wrap gap-1 rounded-lg border border-line bg-[#f0eee5] p-0.75">
          {OPEN_TO_OPTIONS.map((o) => (
            <button
              type="button"
              key={o.id}
              className={`rounded-md px-2.75 py-1.5 text-[13px] font-medium transition-all duration-150 ${
                openTo.includes(o.id)
                  ? "bg-fg text-white shadow-sm"
                  : "text-muted hover:text-fg"
              }`}
              onClick={() => toggleOpenTo(o.id)}
            >
              {o.label}
            </button>
          ))}
        </div>
        {openTo.length > 0 && (
          <AvailabilityField
            hasInternships={openTo.includes("internships")}
            availFrom={availFrom}
            availTo={availTo}
            internshipLength={internshipLength}
            onAvailFromChange={setAvailFrom}
            onAvailToChange={setAvailTo}
            onInternshipLengthChange={setInternshipLength}
          />
        )}
      </Field>

      <Field label="Location" dataField="location" optional>
        <input
          className={`${baseInputClass} border-line-2`}
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="London, UK"
        />
      </Field>

      <Field
        label="One-liner bio"
        dataField="bio"
        error={errors.bio}
        rightSlot={
          <span
            className={`font-mono text-[11px] tracking-[0.04em] ${
              overLimit ? "text-danger" : "text-muted-2"
            }`}
          >
            {charCount}/{BIO_LIMIT}
          </span>
        }
      >
        <textarea
          className={`${baseInputClass} ${
            errors.bio ? "border-danger shadow-err-ring" : "border-line-2"
          }`}
          rows={2}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="What are you working on right now?"
          maxLength={140}
        />
      </Field>

      <Field
        label="Skills"
        dataField="tags"
        error={errors.tags}
        rightSlot={
          <span className="font-mono text-[11px] tracking-[0.04em] text-muted-2">
            {tags.length}/{TAG_LIMIT}
          </span>
        }
      >
        <TagInput tags={tags} onChange={setTags} max={TAG_LIMIT} />
        <div className="mt-2 font-mono text-[11px] tracking-[0.04em] text-muted">
          Press enter or comma to add
        </div>
      </Field>

      <Field label="Contact link" dataField="contact" error={errors.contact}>
        <div className="grid gap-1.5 grid-cols-[130px_1fr] max-[520px]:grid-cols-[1fr]">
          <select
            className={`${baseInputClass} select-caret border-line-2`}
            value={contactType}
            onChange={(e) => setContactType(e.target.value as ContactType)}
          >
            {CONTACT_TYPES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <input
            className={`${baseInputClass} ${
              errors.contact ? "border-danger shadow-err-ring" : "border-line-2"
            }`}
            type="text"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder={
              contactType === "linkedin"
                ? "linkedin.com/in/you"
                : contactType === "email"
                ? "you@example.com"
                : "yourportfolio.com"
            }
          />
        </div>
      </Field>

      <Field label="CV / Resume" dataField="cv" optional optionalText="Optional · PDF">
        <CvUpload
          cvName={cvName}
          onChange={(dataUrl, fileName) => {
            setCvDataUrl(dataUrl);
            setCvName(fileName);
          }}
          onFileChange={setCvFile}
        />
      </Field>

      <div className="mt-8 flex flex-wrap items-center gap-3.5">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-full border border-transparent bg-accent px-5.5 py-3.5 text-[15px] font-semibold text-accent-fg transition-[background,color,transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow-btn-hover active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? submittingLabel : submitLabel}
          {!submitting && (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M3 8H13M13 8L8 3M13 8L8 13"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
        {onCancel && (
          <button
            type="button"
            disabled={submitting}
            onClick={onCancel}
            className="inline-flex items-center gap-2 rounded-full border border-line-2 bg-transparent px-5.5 py-3.5 text-[15px] font-medium text-fg transition-[background,color,transform] duration-150 hover:-translate-y-px hover:bg-white active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {cancelLabel}
          </button>
        )}
        {showSubmitHint && (
          <span className="font-mono text-[11px] text-muted">
            Your profile is public the second you submit
          </span>
        )}
      </div>
    </form>
  );
}

function Field({
  label,
  children,
  dataField,
  optional,
  optionalText = "Optional",
  rightSlot,
  error,
}: {
  label: string;
  children: React.ReactNode;
  dataField: string;
  optional?: boolean;
  optionalText?: string;
  rightSlot?: React.ReactNode;
  error?: string;
}) {
  return (
    <div className="mb-5.5" data-field={dataField}>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[13px] font-medium text-fg">{label}</span>
        {rightSlot ??
          (optional && (
            <span className="font-mono text-[11px] text-muted-2 tracking-[0.04em]">
              {optionalText}
            </span>
          ))}
      </div>
      {children}
      {error && (
        <div className="mt-1.5 font-mono text-[11px] tracking-[0.02em] text-danger">
          ↳ {error}
        </div>
      )}
    </div>
  );
}
