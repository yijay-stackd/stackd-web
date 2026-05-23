"use client";

import { useEffect, useState } from "react";
import { LoadingPage } from "@/components/ui/loading-page";

// Rotates through playful status lines while the join pipeline runs. The
// order is loosely mapped to pipeline stages (create → uploads → skills →
// readiness), so a user who watches them briefly gets a vague sense of
// progress instead of one frozen string.
const MESSAGES = [
  "Putting you on the map.",
  "Saving your photo.",
  "Tucking in your skills.",
  "Brewing your bio.",
  "Polishing your profile.",
  "Almost there.",
] as const;

const ROTATE_MS = 1800;

export function SubmittingOverlay() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(
      () => setIdx((i) => (i + 1) % MESSAGES.length),
      ROTATE_MS
    );
    return () => clearInterval(t);
  }, []);

  return <LoadingPage title="Going live…" subtitle={MESSAGES[idx]} />;
}
