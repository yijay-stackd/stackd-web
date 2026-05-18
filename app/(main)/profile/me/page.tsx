"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/auth-provider";
import { useMyProfile } from "@/features/profile/use-my-profile";

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

  return (
    <div className="mx-auto max-w-220 px-7 py-15 text-center text-muted max-[640px]:px-5">
      Loading…
    </div>
  );
}
