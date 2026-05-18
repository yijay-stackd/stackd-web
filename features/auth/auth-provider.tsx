"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { env } from "@/lib/env";
import { profilesKeys } from "@/lib/api/profiles";
import type { AuthUser } from "@/types/student";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  user: AuthUser | null;
  session: Session | null;
  supabaseUser: User | null;
  status: AuthStatus;
  sendOtp: (email: string) => Promise<void>;
  verifyOtp: (email: string, token: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  // Initial: skip the loading flash when Supabase isn't configured — we know
  // we're anonymous without any async work.
  const [status, setStatus] = useState<AuthStatus>(() =>
    env.hasSupabase ? "loading" : "unauthenticated"
  );
  // Track the previous session's user id so we can detect transitions
  // (sign-out, switch-user) and evict per-user cache.
  const prevUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!env.hasSupabase) return;

    const supabase = getSupabaseBrowser();
    let active = true;

    // Policy: this app identifies users by email. A session without an email
    // (phone-only auth, OAuth without email scope) is rejected — sign the
    // user out and treat them as anonymous rather than render the app in a
    // half-authenticated state where `user` is null but `status` is auth'd.
    function applySession(next: Session | null) {
      if (next && !next.user?.email) {
        console.warn(
          "[auth] Rejecting session: no email on the Supabase user."
        );
        void supabase.auth.signOut();
        setSession(null);
        setStatus("unauthenticated");
        return;
      }

      // Evict per-user caches whenever the identity changes (sign-out OR
      // sign-in-as-different-user). Skipping universities — it's public and
      // user-agnostic. Profiles cache must NOT carry across users.
      const prevUserId = prevUserIdRef.current;
      const nextUserId = next?.user?.id ?? null;
      if (prevUserId !== nextUserId) {
        if (prevUserId !== null) {
          qc.removeQueries({ queryKey: profilesKeys.all });
        }
        prevUserIdRef.current = nextUserId;
      }

      setSession(next);
      setStatus(next ? "authenticated" : "unauthenticated");
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      applySession(data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      applySession(next);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
    // qc is a stable singleton from QueryClientProvider — listing it for
    // exhaustive-deps without re-running the subscription on its identity.
  }, [qc]);

  const sendOtp = useCallback(async (email: string) => {
    const { error } = await getSupabaseBrowser().auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    if (error) throw error;
  }, []);

  const verifyOtp = useCallback(async (email: string, token: string) => {
    const { error } = await getSupabaseBrowser().auth.verifyOtp({
      email,
      token,
      type: "email",
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await getSupabaseBrowser().auth.signOut();
  }, []);

  // Session is normalized by applySession above — when set, email is present.
  const user: AuthUser | null = useMemo(
    () => (session?.user?.email ? { email: session.user.email } : null),
    [session]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      supabaseUser: session?.user ?? null,
      status,
      sendOtp,
      verifyOtp,
      signOut,
    }),
    [user, session, status, sendOtp, verifyOtp, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
