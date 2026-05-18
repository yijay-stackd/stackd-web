"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/auth-provider";
import { useMyProfile } from "@/features/profile/use-my-profile";
import { EditProfileForm } from "@/features/profile/edit-profile-form";

export default function EditProfileMePage() {
  const router = useRouter();
  const { status } = useAuth();
  const { data: profile, isLoading } = useMyProfile();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    if (status === "authenticated" && !isLoading && !profile) {
      router.replace("/join");
    }
  }, [status, profile, isLoading, router]);

  if (status !== "authenticated" || isLoading || !profile) {
    return (
      <div className="mx-auto max-w-220 px-7 py-15 text-center text-muted max-[640px]:px-5">
        Loading…
      </div>
    );
  }

  return <EditProfileForm profile={profile} />;
}
