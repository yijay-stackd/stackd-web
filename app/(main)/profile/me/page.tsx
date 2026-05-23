"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/auth-provider";
import { useMyProfile } from "@/features/profile/use-my-profile";
import { LoadingPage } from "@/components/ui/loading-page";

export default function ProfileMePage() {
  const router = useRouter();
  const { status } = useAuth();
  const { data: profile, isLoading } = useMyProfile();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    if (status !== "authenticated" || isLoading) return;
    // Authed but no profile yet → join flow. Authed + profile → public URL.
    if (!profile) {
      router.replace("/join");
    } else {
      router.replace(`/profile/${profile.slug}`);
    }
  }, [status, profile, isLoading, router]);

  return <LoadingPage title="Finding your profile…" />;
}
