"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useStudents } from "@/components/providers/students-provider";
import { useAuth } from "@/components/providers/auth-provider";
import type { Student } from "@/types/student";
import { StudentForm, type StudentFormValues } from "@/components/forms/student-form";
import { EditHeader } from "./edit-header";
import { DangerZone } from "./danger-zone";
import { DeleteModal } from "./delete-modal";
import { Toast } from "@/components/ui/toast";

type Props = {
  student: Student;
};

export function EditProfileForm({ student }: Props) {
  const router = useRouter();
  const { updateStudent, deleteStudent } = useStudents();
  const { setUserSlug } = useAuth();

  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  function handleSave(values: StudentFormValues) {
    const updated: Student = {
      ...student,
      name: values.name,
      photo: values.photo,
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
      cvDataUrl: values.cvDataUrl,
      cvName: values.cvName,
      updatedAt: new Date().toISOString(),
    };
    updateStudent(updated);
    setSavedAt(Date.now());
  }

  function handleCancel() {
    router.push(`/profile/${student.slug}`);
  }

  function handleDeleteConfirm() {
    deleteStudent(student.slug);
    setUserSlug(null);
    setDeleteOpen(false);
    router.push("/");
  }

  return (
    <div className="animate-pageIn">
      <div className="mx-auto max-w-135 px-7 pt-10 pb-24 max-[640px]:px-5">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href={`/profile/${student.slug}`}
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
            href={`/profile/${student.slug}`}
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

        <StudentForm
          initial={student}
          submitLabel="Save changes"
          submittingLabel="Saving…"
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
