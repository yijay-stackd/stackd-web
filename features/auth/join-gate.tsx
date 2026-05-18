import Link from "next/link";

export function JoinGate() {
  const bullets = [
    {
      n: 1,
      title: "Sign in with a code",
      body: "Six digits, sent to your inbox.",
    },
    {
      n: 2,
      title: "Fill in your profile",
      body: "Course, skills, what you're open to.",
    },
    {
      n: 3,
      title: "Go live",
      body: "Companies find you and reach out directly.",
    },
  ];

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
          Step 1 · Sign in
        </div>
        <h1 className="mb-3 text-[clamp(28px,4vw,40px)] font-semibold leading-[1.05] tracking-[-0.028em]">
          Sign in to create
          <br />
          your profile.
        </h1>
        <p className="mb-9 text-[15px] text-muted">
          A quick one-time check so only you can edit your profile later. No password — we&apos;ll email you a 6-digit code.
        </p>

        <div className="mb-9 flex flex-col gap-1">
          {bullets.map((b, i) => (
            <div
              key={b.n}
              className={`flex items-start gap-3.5 py-3.5 ${
                i === bullets.length - 1 ? "" : "border-b border-line"
              }`}
            >
              <span className="grid h-6.5 w-6.5 shrink-0 place-items-center rounded-full bg-fg font-mono text-xs font-semibold text-accent">
                {b.n}
              </span>
              <div>
                <strong className="block text-[14.5px] font-semibold tracking-[-0.01em]">
                  {b.title}
                </strong>
                <span className="block text-[13px] text-muted">{b.body}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3.5">
          <Link
            href="/login?redirectTo=join"
            className="inline-flex items-center gap-2 rounded-full border border-transparent bg-accent px-5.5 py-3.5 text-[15px] font-semibold text-accent-fg transition-[background,color,transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow-btn-hover active:translate-y-0"
          >
            Sign in to continue
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M3 8H13M13 8L8 3M13 8L8 13"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <span className="font-mono text-[11px] text-muted">
            Free · No account, just an email
          </span>
        </div>
      </div>
    </div>
  );
}
