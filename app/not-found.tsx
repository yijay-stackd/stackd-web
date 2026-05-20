import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-220 animate-pageIn px-7 max-[640px]:px-5">
      <div className="flex flex-col items-center pt-15 pb-20 text-center">
        <div
          className="mb-6 animate-pop font-mono text-[88px] font-medium leading-none tracking-[-0.04em] text-accent"
          style={{ WebkitTextStroke: "1.5px var(--color-fg)" }}
        >
          404
        </div>
        <h1 className="mb-3.5 text-balance text-[clamp(26px,3.6vw,36px)] font-semibold leading-[1.1] tracking-[-0.025em]">
          This page doesn&apos;t exist or was moved.
        </h1>
        <p className="m-0 mb-8 max-w-110 text-pretty text-[15px] text-muted">
          Check the link, or head back to the directory.
        </p>
        <div className="flex flex-wrap justify-center gap-2.5">
          <Link
            href="/"
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-transparent bg-accent px-4 py-2.25 text-sm font-semibold text-accent-fg transition-[background,color,transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow-btn-hover active:translate-y-0"
          >
            Browse directory
          </Link>
          <Link
            href="/join"
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-line-2 bg-transparent px-4 py-2.25 text-sm font-medium text-fg transition-[background,color,transform] duration-150 hover:-translate-y-px hover:bg-white active:translate-y-0"
          >
            Create your profile
          </Link>
        </div>
      </div>
    </div>
  );
}
