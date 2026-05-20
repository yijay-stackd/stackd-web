import type { NextRequest } from "next/server";
import { refreshSupabaseSession } from "@/lib/supabase/proxy";

// Runs before every page request. Keeps the user's login fresh so they
// don't get randomly logged out. Doesn't decide who can access what —
// that's the job of individual pages.
export async function proxy(request: NextRequest) {
  return refreshSupabaseSession(request);
}

export const config = {
  // Run on every URL except static stuff (images, favicon, Next's own files).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
