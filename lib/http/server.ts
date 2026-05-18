import "server-only";

import { env } from "../env";
import { getSupabaseServer } from "../supabase/server";
import { createHttp, type Http } from "./fetcher";

// Server HTTP instance. Per-request: builds a fresh client each call so the
// token reflects the request's cookies (proxy.ts refreshes them upstream).
export async function getHttpServer(): Promise<Http> {
  return createHttp({
    tokenProvider: async () => {
      if (!env.hasSupabase) return null;
      const supabase = await getSupabaseServer();
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? null;
    },
  });
}
