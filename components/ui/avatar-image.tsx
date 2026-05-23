"use client";

import { useState } from "react";

type Props = {
  src: string | null;
  alt: string;
  // Rendered when `src` is null OR the image fails to load. Caller supplies
  // initials/placeholder content so the host component keeps full control of
  // sizing, colors, and typography for the fallback.
  fallback: React.ReactNode;
  className?: string;
};

// Photo URLs point at Supabase public storage. CDN races, bucket glitches,
// or stale `photo_key` references can all 404 — show the initials fallback
// instead of a broken-image icon.
export function AvatarImage({ src, alt, fallback, className }: Props) {
  const [broken, setBroken] = useState(false);

  if (!src || broken) return <>{fallback}</>;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setBroken(true)}
    />
  );
}
