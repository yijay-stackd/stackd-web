"use client";

import { JoinForm } from "@/components/join/join-form";
import { JoinGate } from "@/components/auth/join-gate";
import { ProfileExists } from "@/components/auth/profile-exists";
import { useAuth } from "@/components/providers/auth-provider";
import { useStudents } from "@/components/providers/students-provider";

export default function JoinPage() {
  const { user } = useAuth();
  const { findByEmail, getStudent } = useStudents();

  if (!user) return <JoinGate />;

  const existing =
    (user.slug && getStudent(user.slug)) || findByEmail(user.email) || null;
  if (existing) {
    return <ProfileExists student={existing} email={user.email} />;
  }

  return <JoinForm signedInEmail={user.email} />;
}
