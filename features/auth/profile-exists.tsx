"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/auth-provider";
import { initials } from "@/utils/student";
import type { Student } from "@/types/student";
import { AvatarImage } from "@/components/ui/avatar-image";

type Props = {
  student: Student;
  email: string;
};

export function ProfileExists({ student, email }: Props) {
  const router = useRouter();
  const { signOut } = useAuth();

  function handleSignOut() {
    signOut();
    router.push("/login");
  }

  return (
    <div className="animate-pageIn">
      <div className="mx-auto max-w-125 px-7 pt-8 pb-20 max-[640px]:px-5">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors duration-150 hover:text-fg"
        >
          ← Back to directory
        </Link>

        <div className="mb-3.5 block font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
          One profile per person
        </div>
        <h1 className="mb-3 text-[clamp(28px,4vw,40px)] font-semibold leading-[1.05] tracking-[-0.028em]">
          You&apos;re already on stackd.
        </h1>
        <p className="mb-7 text-[15px] text-muted">
          The email{" "}
          <strong className="font-medium text-fg">{email}</strong> is linked to the profile below. You can view or edit it — or sign out to use a different email.
        </p>

        <Link
          href={`/profile/${student.slug}`}
          className="group/card my-6 flex items-center gap-4 rounded-lg border border-line-2 bg-white p-4 transition-[border-color,transform,box-shadow] duration-150 hover:-translate-y-px hover:border-fg hover:shadow-[0_8px_24px_-10px_rgba(0,0,0,0.15)]"
        >
          <div
            className="grid h-13 w-13 place-items-center overflow-hidden rounded-[10px] text-[17px] font-semibold tracking-[-0.02em] text-[rgba(10,10,10,0.55)]"
            style={{ background: student.photoColor }}
          >
            <AvatarImage
              src={student.photo ?? null}
              alt=""
              className="h-full w-full object-cover"
              fallback={<span>{initials(student.name)}</span>}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-base font-semibold leading-tight tracking-[-0.018em]">
              {student.name}
            </div>
            <div className="mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] text-muted">
              {student.university} · {student.course}
            </div>
          </div>
          <span className="text-fg transition-transform duration-150 group-hover/card:translate-x-0.75">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M3 7H11M11 7L7 3M11 7L7 11"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </Link>

        <div className="mt-8 flex flex-wrap items-center gap-3.5">
          <Link
            href={`/profile/${student.slug}`}
            className="inline-flex items-center gap-2 rounded-full border border-transparent bg-accent px-5.5 py-3.5 text-[15px] font-semibold text-accent-fg transition-[background,color,transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow-btn-hover active:translate-y-0"
          >
            View my profile
          </Link>
          <Link
            href="/profile/me/edit"
            className="inline-flex items-center gap-2 rounded-full border border-line-2 bg-transparent px-4 py-2.25 text-sm font-medium text-fg transition-[background,color,transform] duration-150 hover:-translate-y-px hover:bg-white active:translate-y-0"
          >
            Edit profile
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="text-[13px] text-muted underline underline-offset-2 transition-colors duration-150 hover:text-fg"
          >
            Sign out &amp; use a different email
          </button>
        </div>
      </div>
    </div>
  );
}
