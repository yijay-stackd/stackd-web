import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "../env";

// Login tokens expire after about an hour. This function quietly renews
// the user's token on every request so they stay logged in.
export async function refreshSupabaseSession(
  request: NextRequest
): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  // No Supabase configured? Just let the request through — public pages still work.
  if (!env.hasSupabase) return response;

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      // Hand Supabase the cookies that came in with this request.
      getAll() {
        return request.cookies.getAll().map(({ name, value }) => ({
          name,
          value,
        }));
      },
      // When Supabase issues new cookies (renewed token), save them in
      // two places: the request (so this page sees the new login right
      // now) and the response (so the browser remembers it next time).
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

  // Asking Supabase for the user is what triggers a token renewal if it's expired.
  await supabase.auth.getUser();

  return response;
}
