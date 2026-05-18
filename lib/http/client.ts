"use client";

import { env } from "../env";
import { getSupabaseBrowser } from "../supabase/browser";
import { createHttp, type Http } from "./fetcher";

// Single-flight refresh: a burst of concurrent 401s collapses into one
// supabase.auth.refreshSession() call. Refresh tokens are single-use in some
// Supabase configs, so parallel refreshes can invalidate each other.
let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (!env.hasSupabase) return false;
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const { data, error } =
        await getSupabaseBrowser().auth.refreshSession();
      return !error && Boolean(data.session);
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

let cached: Http | null = null;

export function getHttpClient(): Http {
  if (cached) return cached;

  cached = createHttp({
    tokenProvider: async () => {
      // Public endpoints work without auth — return null when Supabase isn't
      // configured (dev without env) instead of throwing.
      if (!env.hasSupabase) return null;
      const { data } = await getSupabaseBrowser().auth.getSession();
      return data.session?.access_token ?? null;
    },
    onRefreshSession: refreshSession,
    onAuthExpired: async () => {
      if (!env.hasSupabase) return;
      await getSupabaseBrowser().auth.signOut();
      if (typeof window !== "undefined") {
        window.location.replace("/login");
      }
    },
  });

  return cached;
}
