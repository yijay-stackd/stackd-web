"use client";

import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/auth-provider";
import { useStudents } from "@/components/providers/students-provider";

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type Phase = "idle" | "sending" | "sent" | "verifying" | "error";

const baseInputClass =
  "w-full rounded-md border bg-white px-3.5 py-2.75 text-[14.5px] outline-none transition-[border-color,box-shadow] duration-150 focus:border-fg focus:shadow-focus-ring";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get("redirectTo");
  const { signIn } = useAuth();
  const { findByEmail } = useStudents();

  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [errMsg, setErrMsg] = useState("");
  const sendCountRef = useRef(0);
  const lastSendAtRef = useRef(0);

  function send(ev?: React.FormEvent<HTMLFormElement>) {
    ev?.preventDefault();
    const v = email.trim().toLowerCase();
    if (!EMAIL_RX.test(v)) {
      setPhase("error");
      setErrMsg("That doesn't look like an email address.");
      return;
    }
    const now = Date.now();
    if (now - lastSendAtRef.current < 30_000) {
      sendCountRef.current += 1;
    } else {
      sendCountRef.current = 1;
    }
    lastSendAtRef.current = now;
    if (sendCountRef.current > 3) {
      setPhase("error");
      setErrMsg("Too many attempts. Try again in a minute.");
      return;
    }
    setPhase("sending");
    setErrMsg("");
    setTimeout(() => setPhase("sent"), 650);
  }

  function openMagicLink() {
    setPhase("verifying");
    setTimeout(() => {
      const v = email.trim().toLowerCase();
      const matched = findByEmail(v);
      signIn(v, matched ? matched.slug : null);
      if (matched) {
        router.replace(`/profile/${matched.slug}`);
      } else if (redirectTarget === "join") {
        router.replace("/join");
      } else {
        router.replace("/join");
      }
    }, 900);
  }

  function useDifferentEmail() {
    setPhase("idle");
    setErrMsg("");
  }

  const showForm = phase !== "sent" && phase !== "verifying";

  return (
    <div className="animate-pageIn">
      <div className="mx-auto max-w-125 px-7 pt-8 pb-20 max-[640px]:px-5">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors duration-150 hover:text-fg"
        >
          ← Back
        </Link>

        {showForm && (
          <>
            <div className="mb-3.5 block font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
              Sign in · No password
            </div>
            <h1 className="mb-3 text-[clamp(28px,4vw,40px)] font-semibold leading-[1.05] tracking-[-0.028em]">
              Welcome back.
            </h1>
            <p className="mb-10 text-[15px] text-muted">
              Enter your email and we&apos;ll send you a magic link. New here? You&apos;ll create your profile after signing in.
            </p>

            <form onSubmit={send} noValidate>
              <div className="mb-5.5">
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-[13px] font-medium text-fg">
                    Email address
                  </span>
                </div>
                <input
                  className={`${baseInputClass} ${
                    phase === "error" ? "border-danger shadow-err-ring" : "border-line-2"
                  }`}
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (phase === "error") setPhase("idle");
                  }}
                  placeholder="you@university.edu"
                  autoFocus
                  autoComplete="email"
                  disabled={phase === "sending"}
                />
                {phase === "error" && (
                  <div className="mt-1.5 font-mono text-[11px] tracking-[0.02em] text-danger">
                    ↳ {errMsg}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={phase === "sending"}
                className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-full border border-transparent bg-accent px-5.5 py-3.5 text-[15px] font-semibold text-accent-fg transition-[background,color,transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow-btn-hover active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {phase === "sending" ? (
                  <>
                    <Spinner />
                    Sending…
                  </>
                ) : (
                  <>
                    Send magic link
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M3 8H13M13 8L8 3M13 8L8 13"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </>
                )}
              </button>

              <div className="mt-3.5 flex items-center gap-1.5 font-mono text-[11px] tracking-[0.02em] text-muted">
                <svg
                  className="shrink-0 text-muted-2"
                  width="12"
                  height="12"
                  viewBox="0 0 14 14"
                  fill="none"
                >
                  <path
                    d="M7 4V7M7 9.5V10M12 7C12 9.76 9.76 12 7 12C4.24 12 2 9.76 2 7C2 4.24 4.24 2 7 2C9.76 2 12 4.24 12 7Z"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                  />
                </svg>
                stackd doesn&apos;t use passwords. One email, one tap.
              </div>
            </form>

            <div className="my-9 mb-4 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-2 before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
              <span>Demo emails</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => setEmail("maya@example.com")}
                className="rounded-md border border-line bg-white px-3.5 py-3 text-left transition-[border-color,background,transform] duration-150 hover:-translate-y-px hover:border-fg hover:bg-[#fdfcf5]"
              >
                <strong className="block font-mono text-[12.5px] font-medium tracking-[0.02em] text-fg">
                  maya@example.com
                </strong>
                <span className="mt-0.75 block text-xs text-muted">
                  has a profile · → /profile/maya-chen
                </span>
              </button>
              <button
                type="button"
                onClick={() => setEmail("new@example.com")}
                className="rounded-md border border-line bg-white px-3.5 py-3 text-left transition-[border-color,background,transform] duration-150 hover:-translate-y-px hover:border-fg hover:bg-[#fdfcf5]"
              >
                <strong className="block font-mono text-[12.5px] font-medium tracking-[0.02em] text-fg">
                  new@example.com
                </strong>
                <span className="mt-0.75 block text-xs text-muted">
                  no profile · → /join
                </span>
              </button>
            </div>
          </>
        )}

        {phase === "sent" && (
          <div>
            <div className="mb-6 grid h-16 w-16 animate-pop place-items-center rounded-lg bg-accent text-accent-fg">
              <svg width="36" height="36" viewBox="0 0 44 44" fill="none">
                <rect
                  x="6"
                  y="11"
                  width="32"
                  height="22"
                  rx="3"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M6 13L22 24L38 13"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h1 className="mb-3 text-[clamp(28px,4vw,40px)] font-semibold leading-[1.05] tracking-[-0.028em]">
              Check your email.
            </h1>
            <p className="mb-7 text-[15px] text-muted">
              We sent a magic link to{" "}
              <strong className="font-medium text-fg">
                {email.trim().toLowerCase()}
              </strong>
              . Click the link to sign in — it expires in 15 minutes.
            </p>

            <div className="my-7 grid items-start gap-x-4 gap-y-3 rounded-md border border-[#ecdfa3] bg-[#fdfaeb] p-4.5 grid-cols-[auto_1fr]">
              <div className="self-start rounded bg-fg px-1.75 py-0.75 font-mono text-[10px] font-semibold tracking-[0.08em] text-accent">
                DEMO
              </div>
              <div>
                <strong className="mb-0.75 block text-[13.5px] font-semibold tracking-[-0.01em]">
                  No real email was sent.
                </strong>
                <span className="mb-3.5 block text-[12.5px] text-muted">
                  Tap the button below to simulate clicking the link in your inbox.
                </span>
              </div>
              <button
                type="button"
                onClick={openMagicLink}
                className="col-span-2 inline-flex w-full items-center justify-center gap-2 rounded-full border border-transparent bg-accent px-4 py-2.25 text-sm font-semibold text-accent-fg transition-[background,color,transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow-btn-hover active:translate-y-0"
              >
                Open the magic link →
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 text-[13px]">
              <button
                type="button"
                onClick={() => send()}
                className="text-[13px] text-muted underline underline-offset-2 transition-colors duration-150 hover:text-fg"
              >
                Resend
              </button>
              <span className="text-muted-2">·</span>
              <button
                type="button"
                onClick={useDifferentEmail}
                className="text-[13px] text-muted underline underline-offset-2 transition-colors duration-150 hover:text-fg"
              >
                Use a different email
              </button>
            </div>
          </div>
        )}

        {phase === "verifying" && (
          <div className="py-20 text-center">
            <div className="mb-6 inline-flex">
              <span
                className="inline-block h-8 w-8 animate-spin rounded-full border-[2.5px] border-fg border-r-transparent"
                style={{ animationDuration: "0.7s" }}
              />
            </div>
            <h2 className="mb-1.5 text-2xl font-semibold tracking-[-0.02em]">
              Signing you in…
            </h2>
            <p className="text-[15px] text-muted">Just a moment.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <span
      className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent align-[-2px]"
      style={{ animationDuration: "0.7s" }}
    />
  );
}
