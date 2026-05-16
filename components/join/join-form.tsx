"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStudents } from "@/components/providers/students-provider";
import { useAuth } from "@/components/providers/auth-provider";
import { PHOTO_COLORS } from "@/constants/student-options";
import type { Student } from "@/types/student";
import { slugify } from "@/utils/student";
import { Celebration } from "./celebration";
import { StudentForm, type StudentFormValues } from "@/components/forms/student-form";

const REDIRECT_DELAY_MS = 1700;

type Props = {
  signedInEmail?: string;
};

export function JoinForm({ signedInEmail }: Props = {}) {
  const router = useRouter();
  const { addStudent } = useStudents();
  const { setUserSlug } = useAuth();

  const [celebrating, setCelebrating] = useState(false);
  const [firstName, setFirstName] = useState("");

  function handleSubmit(values: StudentFormValues) {
    const student: Student = {
      slug: slugify(values.name),
      name: values.name,
      university: values.university,
      course: values.course,
      year: values.year,
      location: values.location,
      openTo: values.openTo,
      availability: values.availability,
      internshipLength: values.internshipLength,
      bio: values.bio,
      tags: values.tags,
      contactType: values.contactType,
      contact: values.contact,
      email: signedInEmail || null,
      photo: values.photo,
      photoColor: PHOTO_COLORS[Math.floor(Math.random() * PHOTO_COLORS.length)],
      cvDataUrl: values.cvDataUrl,
      cvName: values.cvName,
      addedAt: new Date().toISOString().slice(0, 10),
    };
    setFirstName(values.name.split(" ")[0]);
    setCelebrating(true);
    setTimeout(() => {
      addStudent(student);
      if (signedInEmail) setUserSlug(student.slug);
      router.push(`/profile/${student.slug}`);
    }, REDIRECT_DELAY_MS);
  }

  return (
    <div className="animate-pageIn">
      <div className="mx-auto max-w-135 px-7 pt-13 pb-24 max-[640px]:px-5">
        <div className="mb-3.5 block font-mono text-[11px] uppercase tracking-widest text-muted">
          Step 1 of 1 · No account needed
        </div>
        <h1 className="mb-3 text-[clamp(28px,4vw,40px)] font-semibold leading-[1.05] tracking-[-0.028em]">
          Put yourself on the map.
        </h1>
        <p className="mb-10 text-[15px] text-muted">
          One page. One form. Goes live the moment you hit submit. Companies browse, find you, reach out directly.
        </p>

        <StudentForm
          submitLabel="Go live"
          submittingLabel="Going live…"
          submitting={celebrating}
          showSubmitHint
          onSubmit={handleSubmit}
        />
      </div>

      {celebrating && <Celebration firstName={firstName} />}
    </div>
  );
}
