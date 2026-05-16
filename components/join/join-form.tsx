"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStudents } from "@/components/providers/students-provider";
import {
  CONTACT_TYPES,
  OPEN_TO_OPTIONS,
  PHOTO_COLORS,
  YEAR_OPTIONS,
} from "@/constants/student-options";
import type { ContactType, OpenToId, Student } from "@/types/student";
import { slugify } from "@/utils/student";
import { PhotoUpload } from "./photo-upload";
import { TagInput } from "./tag-input";
import { CvUpload } from "./cv-upload";
import { Celebration } from "./celebration";

const BIO_LIMIT = 100;
const TAG_LIMIT = 6;
const REDIRECT_DELAY_MS = 1700;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function JoinForm() {
  const router = useRouter();
  const { addStudent } = useStudents();

  const [name, setName] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [university, setUniversity] = useState("");
  const [course, setCourse] = useState("");
  const [year, setYear] = useState("");
  const [location, setLocation] = useState("");
  const [openTo, setOpenTo] = useState<OpenToId[]>([]);
  const [bio, setBio] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [contactType, setContactType] = useState<ContactType>("linkedin");
  const [contact, setContact] = useState("");
  const [cvDataUrl, setCvDataUrl] = useState<string | null>(null);
  const [cvName, setCvName] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [celebrating, setCelebrating] = useState(false);

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
    setSubmitting(true);
    const student: Student = {
      slug: slugify(name),
      name: name.trim(),
      university: university.trim(),
      course: course.trim(),
      year,
      location: location.trim() || null,
      openTo,
      availability: openTo.length ? { from: "Now", to: "Ongoing" } : null,
      internshipLength: null,
      bio: bio.trim(),
      tags,
      contactType,
      contact: contact.trim(),
      photo: photo || null,
      photoColor: PHOTO_COLORS[Math.floor(Math.random() * PHOTO_COLORS.length)],
      cvDataUrl,
      cvName,
      addedAt: new Date().toISOString().slice(0, 10),
    };
    setCelebrating(true);
    setTimeout(() => {
      addStudent(student);
      router.push(`/profile/${student.slug}`);
    }, REDIRECT_DELAY_MS);
  }

  const charCount = bio.length;
  const overLimit = charCount > BIO_LIMIT;

  const baseInputClass =
    "w-full rounded-md border bg-white px-3.5 py-2.75 text-[14.5px] outline-none transition-[border-color,box-shadow] duration-150 focus:border-fg focus:shadow-focus-ring";

  return (
    <div className="animate-pageIn">
      <div className="mx-auto max-w-135 px-7 pt-13 pb-24 max-[640px]:px-5">
        <div className="mb-3.5 block font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
          Step 1 of 1 · No account needed
        </div>
        <h1 className="mb-3 text-[clamp(28px,4vw,40px)] font-semibold leading-[1.05] tracking-[-0.028em]">
          Put yourself on the map.
        </h1>
        <p className="mb-10 text-[15px] text-muted">
          One page. One form. Goes live the moment you hit submit. Companies browse, find you, reach out directly.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-5.5" data-field="photo">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-[13px] font-medium text-fg">Profile photo</span>
              <span className="font-mono text-[11px] text-muted-2 tracking-[0.04em]">Optional</span>
            </div>
            <PhotoUpload value={photo} onChange={setPhoto} name={name} />
          </div>

          <div className="mb-5.5" data-field="name">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-[13px] font-medium text-fg">Full name</span>
            </div>
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
            {errors.name && (
              <div className="font-mono text-[11px] text-danger mt-1.5 tracking-[0.02em]">
                ↳ {errors.name}
              </div>
            )}
          </div>

          <div className="mb-5.5" data-field="university">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-[13px] font-medium text-fg">University</span>
            </div>
            <input
              className={`${baseInputClass} ${
                errors.university ? "border-danger shadow-err-ring" : "border-line-2"
              }`}
              type="text"
              value={university}
              onChange={(e) => setUniversity(e.target.value)}
              placeholder="Stanford University"
            />
            {errors.university && (
              <div className="font-mono text-[11px] text-danger mt-1.5 tracking-[0.02em]">
                ↳ {errors.university}
              </div>
            )}
          </div>

          <div className="mb-5.5" data-field="course">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-[13px] font-medium text-fg">Course / Major</span>
            </div>
            <input
              className={`${baseInputClass} ${
                errors.course ? "border-danger shadow-err-ring" : "border-line-2"
              }`}
              type="text"
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              placeholder="Computer Science"
            />
            {errors.course && (
              <div className="font-mono text-[11px] text-danger mt-1.5 tracking-[0.02em]">
                ↳ {errors.course}
              </div>
            )}
          </div>

          <div className="mb-5.5" data-field="year">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-[13px] font-medium text-fg">Year of study</span>
            </div>
            <div className="inline-flex flex-wrap gap-1 max-w-full rounded-lg border border-line bg-[#f0eee5] p-[3px]">
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
            {errors.year && (
              <div className="font-mono text-[11px] text-danger mt-3.5 tracking-[0.02em]">
                ↳ {errors.year}
              </div>
            )}
          </div>

          <div className="mb-5.5" data-field="openTo">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-[13px] font-medium text-fg">Open to</span>
              <span className="font-mono text-[11px] text-muted-2 tracking-[0.04em]">
                Optional · pick any
              </span>
            </div>
            <div className="inline-flex flex-wrap gap-1 max-w-full rounded-lg border border-line bg-[#f0eee5] p-[3px]">
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
          </div>

          <div className="mb-5.5" data-field="location">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-[13px] font-medium text-fg">Location</span>
              <span className="font-mono text-[11px] text-muted-2 tracking-[0.04em]">
                Optional
              </span>
            </div>
            <input
              className={`${baseInputClass} border-line-2`}
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="London, UK"
            />
          </div>

          <div className="mb-5.5" data-field="bio">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-[13px] font-medium text-fg">One-liner bio</span>
              <span
                className={`font-mono text-[11px] tracking-[0.04em] ${
                  overLimit ? "text-danger" : "text-muted-2"
                }`}
              >
                {charCount}/{BIO_LIMIT}
              </span>
            </div>
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
            {errors.bio && (
              <div className="font-mono text-[11px] text-danger mt-1.5 tracking-[0.02em]">
                ↳ {errors.bio}
              </div>
            )}
          </div>

          <div className="mb-5.5" data-field="tags">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-[13px] font-medium text-fg">Skills</span>
              <span className="font-mono text-[11px] text-muted-2 tracking-[0.04em]">
                {tags.length}/{TAG_LIMIT}
              </span>
            </div>
            <TagInput tags={tags} onChange={setTags} max={TAG_LIMIT} />
            {errors.tags && (
              <div className="font-mono text-[11px] text-danger mt-1.5 tracking-[0.02em]">
                ↳ {errors.tags}
              </div>
            )}
            <div className="mt-2 font-mono text-[11px] tracking-[0.04em] text-muted">
              Press enter or comma to add
            </div>
          </div>

          <div className="mb-5.5" data-field="contact">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-[13px] font-medium text-fg">Contact link</span>
            </div>
            <div className="grid gap-1.5 grid-cols-[130px_1fr] max-[520px]:grid-cols-[1fr]">
              <select
                className={`${baseInputClass} border-line-2 select-caret`}
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
            {errors.contact && (
              <div className="font-mono text-[11px] text-danger mt-1.5 tracking-[0.02em]">
                ↳ {errors.contact}
              </div>
            )}
          </div>

          <div className="mb-5.5" data-field="cv">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-[13px] font-medium text-fg">CV / Resume</span>
              <span className="font-mono text-[11px] text-muted-2 tracking-[0.04em]">
                Optional · PDF
              </span>
            </div>
            <CvUpload
              cvName={cvName}
              onChange={(dataUrl, fileName) => {
                setCvDataUrl(dataUrl);
                setCvName(fileName);
              }}
            />
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3.5">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-full border border-transparent bg-accent px-5.5 py-3.5 text-[15px] font-semibold text-accent-fg transition-[background,color,transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow-btn-hover active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? "Going live…" : "Go live"}
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M3 8H13M13 8L8 3M13 8L8 13"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <span className="font-mono text-[11px] text-muted">
              Your profile is public the second you submit
            </span>
          </div>
        </form>
      </div>

      {celebrating && <Celebration firstName={name.split(" ")[0]} />}
    </div>
  );
}
