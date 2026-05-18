"use client";

import { JoinForm } from "@/features/join/join-form";
import { JoinGate } from "@/features/auth/join-gate";
import { ProfileExists } from "@/features/auth/profile-exists";
import { useAuth } from "@/features/auth/auth-provider";
import { useMyProfile } from "@/features/profile/use-my-profile";
import { toStudent } from "@/lib/api/profile-mapper";

export default function JoinPage() {
  const { user, status } = useAuth();
  const { data: profile, isLoading } = useMyProfile();

  if (status === "loading" || (status === "authenticated" && isLoading)) {
    return (
      <div className="mx-auto max-w-135 px-7 py-15 text-center text-muted max-[640px]:px-5">
        Loading…
      </div>
    );
  }

  if (!user) return <JoinGate />;

  if (profile) {
    return <ProfileExists student={toStudent(profile)} email={user.email} />;
  }

  return <JoinForm />;
}
