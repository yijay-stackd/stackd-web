"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/auth-provider";
import { useMyProfile } from "@/features/profile/use-my-profile";
import { EditProfileForm } from "@/features/profile/edit-profile-form";
import { LoadingPage } from "@/components/ui/loading-page";

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
    return <LoadingPage title="Loading your profile…" />;
  }

  return <EditProfileForm profile={profile} />;
}
