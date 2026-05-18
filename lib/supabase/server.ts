import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env";

// Per-request server client. Never memoize — captures the request's cookies.
// `setAll` is a no-op when called from a Server Component (cookies() is RO);
// token refresh happens in proxy.ts so RSC reads are always current.
export async function getSupabaseServer(): Promise<SupabaseClient> {
  const store = await cookies();

  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return store.getAll().map(({ name, value }) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            store.set(name, value, options);
          }
        } catch {
          // RSC render context — cookies() is read-only. Harmless.
        }
      },
    },
  });
}
