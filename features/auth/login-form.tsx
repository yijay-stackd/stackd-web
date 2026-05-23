"use client";

import Link from "next/link";
import { useLoginForm } from "./use-login-form";
import { LoadingPage } from "@/components/ui/loading-page";

const baseInputClass =
  "w-full rounded-md border bg-white px-3.5 py-2.75 text-[14.5px] outline-none transition-[border-color,box-shadow] duration-150 focus:border-fg focus:shadow-focus-ring";

export function LoginForm() {
  const {
    email,
    setEmail,
    phase,
    errMsg,
    codeStepMsg,
    digits,
    codeErr,
    resendIn,
    OTP_LEN,
    inputsRef,
    send,
    resend,
    setDigitAt,
    onDigitKeyDown,
    onDigitPaste,
    useDifferentEmail,
  } = useLoginForm();

  const showEmailForm =
    phase === "idle" || phase === "sending" || phase === "error";

  return (
    <div className="animate-pageIn">
      <div className="mx-auto max-w-125 px-7 pt-8 pb-20 max-[640px]:px-5">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors duration-150 hover:text-fg"
        >
          ← Back
        </Link>

        {showEmailForm && (
          <>
            <div className="mb-3.5 block font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
              No password · No signup form
            </div>
            <h1 className="mb-3 text-[clamp(28px,4vw,40px)] font-semibold leading-[1.05] tracking-[-0.028em]">
              Welcome to stackd.
            </h1>
            <p className="mb-10 text-[15px] text-muted">
              Drop your email and we&apos;ll send you a 6-digit code. New here?
              You&apos;ll set up your profile right after.
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
                    phase === "error"
                      ? "border-danger shadow-err-ring"
                      : "border-line-2"
                  }`}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@university.edu"
                  autoFocus
                  autoComplete="email"
                  disabled={phase === "sending"}
                />
                {phase === "error" && errMsg && (
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
                    Sending code…
                  </>
                ) : (
                  <>
                    Email me a code
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
                stackd doesn&apos;t use passwords. One email, one code.
              </div>
            </form>
          </>
        )}

        {phase === "code" && (
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
            <div className="mb-3.5 block font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
              Step 2 of 2 · Verify
            </div>
            <h1 className="mb-3 text-[clamp(28px,4vw,40px)] font-semibold leading-[1.05] tracking-[-0.028em]">
              Enter your code.
            </h1>
            <p className="mb-2 text-[15px] text-muted">
              We sent a 6-digit code to{" "}
              <strong className="font-medium text-fg">
                {email.trim().toLowerCase()}
              </strong>
              . It expires in 10 minutes.
            </p>

            <div
              className={`mt-6 mb-2 flex items-center gap-2 ${
                codeErr ? "animate-otpShake" : ""
              }`}
            >
              {digits.map((d, i) => (
                <div key={i} className="contents">
                  <input
                    ref={(el) => {
                      inputsRef.current[i] = el;
                    }}
                    className={`h-15 w-12 flex-1 max-w-14 rounded-md border bg-white p-0 text-center font-mono text-[26px] font-medium outline-none transition-[border-color,box-shadow,background] duration-150 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
                      codeErr
                        ? "border-danger text-danger shadow-err-ring"
                        : d
                          ? "border-fg bg-[#fafaf6] text-fg focus:shadow-focus-ring"
                          : "border-line-2 text-fg focus:border-fg focus:shadow-focus-ring"
                    }`}
                    type="text"
                    inputMode="numeric"
                    autoComplete={i === 0 ? "one-time-code" : "off"}
                    maxLength={1}
                    value={d}
                    onChange={(e) => setDigitAt(i, e.target.value)}
                    onKeyDown={(e) => onDigitKeyDown(i, e)}
                    onPaste={(e) => onDigitPaste(i, e)}
                    onFocus={(e) => e.target.select?.()}
                    aria-label={`Digit ${i + 1} of ${OTP_LEN}`}
                  />
                  {i === 2 && (
                    <span
                      className="px-0.5 select-none font-mono text-[22px] text-muted-2"
                      aria-hidden="true"
                    >
                      –
                    </span>
                  )}
                </div>
              ))}
            </div>

            {codeErr && (
              <div className="mt-1 mb-1.5 font-mono text-[11px] tracking-[0.02em] text-danger">
                ↳ That code didn&apos;t match. Try again.
              </div>
            )}

            {!codeErr && codeStepMsg && (
              <div className="mt-1 mb-1.5 font-mono text-[11px] tracking-[0.02em] text-danger">
                ↳ {codeStepMsg}
              </div>
            )}

            <div className="mt-7 flex flex-wrap items-center gap-2.5 text-[13px]">
              <button
                type="button"
                onClick={resend}
                disabled={resendIn > 0}
                className={
                  resendIn > 0
                    ? "cursor-default font-mono text-[12px] tracking-[0.02em] text-muted-2"
                    : "text-[13px] text-muted underline underline-offset-2 transition-colors duration-150 hover:text-fg"
                }
              >
                {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
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

        {phase === "verifying" && <LoadingPage title="Signing you in…" />}
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
