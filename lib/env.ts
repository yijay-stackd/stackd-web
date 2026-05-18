// Typed env access. Public vars are inlined at build time (process.env access
// must be literal), so we re-read here as a single choke point. Access is lazy
// via getters — missing Supabase vars only throw at the call site, letting
// public routes work before auth is configured.

function missing(name: string): never {
  throw new Error(
    `Missing required env var: ${name}. Add it to .env.local and restart the dev server.`
  );
}

export const env = {
  get apiUrl(): string {
    return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
  },
  get supabaseUrl(): string {
    return process.env.NEXT_PUBLIC_SUPABASE_URL || missing("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseAnonKey(): string {
    return (
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      missing("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    );
  },
  get hasSupabase(): boolean {
    return Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  },
} as const;
