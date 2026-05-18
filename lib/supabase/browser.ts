"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env";

// One browser client per tab. The SDK manages session state + refresh; on the
// browser, omitting `cookies` makes @supabase/ssr read/write `document.cookie`
// directly — no hand-rolled parser needed.
let cached: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient {
  if (cached) return cached;
  cached = createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
  return cached;
}
