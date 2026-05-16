"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { useStudents } from "@/components/providers/students-provider";

export default function ProfileMePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { findByEmail } = useStudents();

  useEffect(() => {
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.slug) {
      router.replace(`/profile/${user.slug}`);
      return;
    }
    const existing = findByEmail(user.email);
    if (existing) {
      router.replace(`/profile/${existing.slug}`);
    } else {
      router.replace("/join");
    }
  }, [user, findByEmail, router]);

  return (
    <div className="mx-auto max-w-220 px-7 py-15 text-center text-muted max-[640px]:px-5">
      Loading…
    </div>
  );
}
