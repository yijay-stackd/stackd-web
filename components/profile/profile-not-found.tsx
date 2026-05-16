import Link from "next/link";

export function ProfileNotFound() {
  return (
    <div className="mx-auto max-w-220 animate-pageIn px-7 py-20 max-[640px]:px-5">
      <Link
        className="my-8 inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors duration-150 hover:text-fg"
        href="/"
      >
        ← Back to directory
      </Link>
      <h1 className="mb-3 text-[clamp(28px,4vw,40px)] font-semibold leading-[1.05] tracking-[-0.028em]">
        Profile not found.
      </h1>
      <p className="text-[15px] text-muted">
        That student doesn&apos;t seem to exist.
      </p>
    </div>
  );
}
