"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/auth-provider";

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_LEN = 6;
const RESEND_SECONDS = 60;

export type LoginPhase =
  | "idle"
  | "sending"
  | "code"
  | "verifying"
  | "error";

// "Invalid token", "expired", "incorrect" — Supabase wording varies by version
// and locale, so we keyword-match conservatively. Anything else is treated as
// a non-mismatch failure (rate limit, network, etc.) and shown as plain text.
// Finds a run of exactly `len` digits with no digit on either side. Equivalent
// to `(?<!\d)\d{len}(?!\d)` but written manually so older Safari (<16.4),
// which doesn't parse regex lookbehind, doesn't throw at module load.
function findIsolatedDigitRun(str: string, len: number): string | null {
  const re = new RegExp(`\\d{${len}}`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(str)) !== null) {
    const before = m.index > 0 ? str[m.index - 1] : "";
    const after = m.index + len < str.length ? str[m.index + len] : "";
    if (!/\d/.test(before) && !/\d/.test(after)) return m[0];
  }
  return null;
}

function isOtpMismatch(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("invalid") ||
    msg.includes("expired") ||
    msg.includes("incorrect") ||
    msg.includes("not found")
  );
}

export function useLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get("redirectTo");
  const { sendOtp, verifyOtp } = useAuth();

  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<LoginPhase>("idle");
  // errMsg drives the email-step error banner. codeStepMsg is a separate slot
  // used only on the OTP step — kept apart so a "couldn't send" message
  // doesn't disappear when we transition into the code phase.
  const [errMsg, setErrMsg] = useState("");
  const [codeStepMsg, setCodeStepMsg] = useState("");
  const [digits, setDigits] = useState<string[]>(() => Array(OTP_LEN).fill(""));
  // codeErr is ONLY for "wrong code" — drives the shake animation + red ring.
  // Non-mismatch failures (rate limit, network, resend errors) use codeStepMsg.
  const [codeErr, setCodeErr] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  const sendMutation = useMutation({
    mutationFn: (e: string) => sendOtp(e),
  });
  const verifyMutation = useMutation({
    mutationFn: (args: { email: string; token: string }) =>
      verifyOtp(args.email, args.token),
  });

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn(resendIn - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  useEffect(() => {
    if (phase !== "code") return;
    const t = setTimeout(() => inputsRef.current[0]?.focus(), 250);
    return () => clearTimeout(t);
  }, [phase]);

  const send = useCallback(
    async (ev?: React.FormEvent<HTMLFormElement>) => {
      ev?.preventDefault();
      const v = email.trim().toLowerCase();
      if (!EMAIL_RX.test(v)) {
        setPhase("error");
        setErrMsg("That doesn't look like an email address.");
        return;
      }
      setPhase("sending");
      setErrMsg("");
      setCodeStepMsg("");
      try {
        await sendMutation.mutateAsync(v);
        setDigits(Array(OTP_LEN).fill(""));
        setCodeErr(false);
        setResendIn(RESEND_SECONDS);
        setPhase("code");
      } catch (err) {
        setPhase("error");
        setErrMsg(
          err instanceof Error
            ? err.message
            : "Couldn't send the code. Try again."
        );
      }
    },
    [email, sendMutation]
  );

  const resend = useCallback(async () => {
    if (resendIn > 0) return;
    const v = email.trim().toLowerCase();
    setCodeStepMsg("");
    try {
      await sendMutation.mutateAsync(v);
      setDigits(Array(OTP_LEN).fill(""));
      setCodeErr(false);
      setResendIn(RESEND_SECONDS);
      inputsRef.current[0]?.focus();
    } catch (err) {
      // Resend failure ≠ wrong code. Show inline text, leave digit boxes calm.
      setCodeStepMsg(
        err instanceof Error ? err.message : "Couldn't resend the code."
      );
    }
  }, [email, resendIn, sendMutation]);

  const verifyCode = useCallback(
    async (value: string) => {
      if (value.length !== OTP_LEN) return;
      setPhase("verifying");
      setCodeStepMsg("");
      try {
        await verifyMutation.mutateAsync({
          email: email.trim().toLowerCase(),
          token: value,
        });
        if (redirectTarget === "join") {
          router.replace("/join");
        } else {
          router.replace("/profile/me");
        }
      } catch (err) {
        setPhase("code");
        if (isOtpMismatch(err)) {
          setCodeErr(true);
          setTimeout(() => {
            setDigits(Array(OTP_LEN).fill(""));
            setCodeErr(false);
            inputsRef.current[0]?.focus();
          }, 700);
        } else {
          // Rate limit, network, anything else — show plain text, keep digits.
          setCodeStepMsg(
            err instanceof Error
              ? err.message
              : "Couldn't verify the code. Try again."
          );
        }
      }
    },
    [email, verifyMutation, router, redirectTarget]
  );

  const handlePastedString = useCallback(
    (str: string, startAt = 0) => {
      // Prefer a contiguous OTP_LEN-digit run (handles emails like
      // "Your stackd code 123456 expires in 10 min" without picking up the
      // "10" or other surrounding numbers). Fall back to digit-only strip
      // for cases where the user manually selected just the digits.
      //
      // Hand-rolled instead of `(?<!\\d)\\d{N}(?!\\d)` because lookbehind in
      // regex literals only landed in Safari/iOS 16.4 — older iPhones would
      // throw SyntaxError at module init.
      const exactRun = findIsolatedDigitRun(str, OTP_LEN);
      const cleaned =
        exactRun ?? str.replace(/\D/g, "").slice(0, OTP_LEN - startAt);
      if (!cleaned) return;

      // Full-code paste should always populate from box 0 — pasting into the
      // middle box was leaving the earlier boxes empty.
      const offset = cleaned.length >= OTP_LEN ? 0 : startAt;

      const next = digits.slice();
      for (let k = 0; k < cleaned.length && offset + k < OTP_LEN; k++) {
        next[offset + k] = cleaned[k];
      }
      setDigits(next);
      const landed = Math.min(offset + cleaned.length, OTP_LEN - 1);
      inputsRef.current[landed]?.focus();
      const joined = next.join("");
      if (joined.length === OTP_LEN && !next.includes("")) {
        verifyCode(joined);
      }
    },
    [digits, verifyCode]
  );

  const setDigitAt = useCallback(
    (i: number, raw: string) => {
      const ch = (raw || "").replace(/\D/g, "");
      if (codeErr) setCodeErr(false);

      if (ch.length > 1) {
        handlePastedString(ch, i);
        return;
      }

      const next = digits.slice();
      next[i] = ch;
      setDigits(next);

      if (ch && i < OTP_LEN - 1) {
        inputsRef.current[i + 1]?.focus();
      }

      const joined = next.join("");
      if (joined.length === OTP_LEN && !next.includes("")) {
        verifyCode(joined);
      }
    },
    [digits, codeErr, verifyCode, handlePastedString]
  );

  const onDigitKeyDown = useCallback(
    (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace") {
        if (digits[i]) {
          const next = digits.slice();
          next[i] = "";
          setDigits(next);
        } else if (i > 0) {
          const next = digits.slice();
          next[i - 1] = "";
          setDigits(next);
          inputsRef.current[i - 1]?.focus();
        }
        e.preventDefault();
      } else if (e.key === "ArrowLeft" && i > 0) {
        inputsRef.current[i - 1]?.focus();
        inputsRef.current[i - 1]?.select?.();
        e.preventDefault();
      } else if (e.key === "ArrowRight" && i < OTP_LEN - 1) {
        inputsRef.current[i + 1]?.focus();
        inputsRef.current[i + 1]?.select?.();
        e.preventDefault();
      } else if (e.key === "Enter") {
        const joined = digits.join("");
        if (joined.length === OTP_LEN) verifyCode(joined);
        e.preventDefault();
      }
    },
    [digits, verifyCode]
  );

  const onDigitPaste = useCallback(
    (i: number, e: React.ClipboardEvent<HTMLInputElement>) => {
      const text = e.clipboardData.getData("text");
      if (text) {
        e.preventDefault();
        handlePastedString(text, i);
      }
    },
    [handlePastedString]
  );

  const useDifferentEmail = useCallback(() => {
    setPhase("idle");
    setErrMsg("");
    setCodeStepMsg("");
    setDigits(Array(OTP_LEN).fill(""));
    setCodeErr(false);
    setResendIn(0);
  }, []);

  return {
    // state
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
    // handlers
    send,
    resend,
    setDigitAt,
    onDigitKeyDown,
    onDigitPaste,
    useDifferentEmail,
  };
}
