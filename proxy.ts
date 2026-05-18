import type { NextRequest } from "next/server";
import { refreshSupabaseSession } from "@/lib/supabase/proxy";

// Next.js 16 proxy (formerly middleware). Sole job: refresh the Supabase
// session cookie on each request so Server Components see a current user.
//
// Auth gating lives in Server Components / Server Actions per the Next 16
// guidance — proxy is fast-path infrastructure, not a security boundary.
export async function proxy(request: NextRequest) {
  return refreshSupabaseSession(request);
}

export const config = {
  // Match every route except Next internals and static assets. The proxy
  // is cheap (one Supabase token check) but skipping these still saves work.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
