"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { useStudents } from "@/components/providers/students-provider";
import { EditProfileForm } from "@/components/edit-profile/edit-profile-form";

export default function EditProfileMePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { findByEmail, getStudent } = useStudents();

  const student = user
    ? (user.slug && getStudent(user.slug)) || findByEmail(user.email) || null
    : null;

  useEffect(() => {
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!student) {
      router.replace("/join");
    }
  }, [user, student, router]);

  if (!user || !student) {
    return (
      <div className="mx-auto max-w-220 px-7 py-15 text-center text-muted max-[640px]:px-5">
        Loading…
      </div>
    );
  }

  return <EditProfileForm student={student} />;
}
