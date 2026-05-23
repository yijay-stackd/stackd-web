"use client";

import { useEffect, useState } from "react";

// Rotates through playful status lines while the join pipeline runs.
// Order is intentional — early lines map to early pipeline steps (create →
// uploads → skills → contact → readiness), so a user who watches them
// briefly gets a vague sense of progress instead of one frozen string.
const MESSAGES = [
  "Putting you on the map…",
  "Saving your photo for recruiters…",
  "Tucking in your skills…",
  "Brewing your bio…",
  "Polishing your profile…",
  "Almost there…",
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

  return (
    <div
      role="status"
      aria-live="polite"
      // Full-page swap (not an overlay). Lives outside the form's transformed
      // ancestor so it always centers against the viewport, not the form box.
      className="min-h-[100svh] animate-fadeIn bg-bg"
    >
      <div className="mx-auto grid min-h-[100svh] max-w-135 place-items-center px-7 max-[640px]:px-5">
        <div className="w-full text-center">
          <div className="mx-auto mb-6 h-12 w-12 animate-spin rounded-full border-[3px] border-line border-t-fg" />
          <h2 className="mb-2 text-[clamp(22px,3vw,28px)] font-semibold tracking-tight">
            Going live
          </h2>
          <p
            // Key on idx so the fade restarts each rotation.
            key={idx}
            className="animate-subIn font-mono text-[12.5px] uppercase tracking-[0.08em] text-muted"
          >
            {MESSAGES[idx]}
          </p>
        </div>
      </div>
    </div>
  );
}
