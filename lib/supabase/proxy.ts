import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "../env";

// Refreshes the Supabase session cookie on each request so RSC sees a current
// user. Per @supabase/ssr docs: getUser() triggers refresh; setAll must write
// to BOTH the request (downstream readers in this request see the new value)
// AND the response (browser persists).
export async function refreshSupabaseSession(
  request: NextRequest
): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  // Graceful degradation when Supabase env is missing — public routes still work.
  if (!env.hasSupabase) return response;

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll().map(({ name, value }) => ({
          name,
          value,
        }));
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Triggers refresh if the access token is stale. Gating belongs in RSC/Actions.
  await supabase.auth.getUser();

  return response;
}
