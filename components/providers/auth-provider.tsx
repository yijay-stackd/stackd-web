"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { AuthUser } from "@/types/student";

const STORAGE_KEY = "stackd:user";

type AuthContextValue = {
  user: AuthUser | null;
  signIn: (email: string, slug: string | null) => void;
  signOut: () => void;
  setUserSlug: (slug: string | null) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.email === "string") {
      return { email: parsed.email, slug: parsed.slug ?? null };
    }
    return null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Reading localStorage requires window, which is only available post-hydration.
    // The cascading render here is intentional and runs exactly once.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUser(readStoredUser());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (user) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  }, [user, hydrated]);

  const signIn = useCallback((email: string, slug: string | null) => {
    setUser({ email, slug });
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
  }, []);

  const setUserSlug = useCallback((slug: string | null) => {
    setUser((prev) => (prev ? { ...prev, slug } : prev));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, signIn, signOut, setUserSlug }),
    [user, signIn, signOut, setUserSlug]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
